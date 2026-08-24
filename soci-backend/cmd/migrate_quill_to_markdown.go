package main

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/urfave/cli"
)

// migrateQuillToMarkdownCommand backfills existing Quill delta JSON stored in the DB
// into CommonMark-ish markdown, in-place in the same columns.
//
// This is implemented as a CLI subcommand (instead of a goose migration) because
// the repo runs migrations via the external goose binary, which does not execute
// Go migrations by default.
func migrateQuillToMarkdownCommand() cli.Command {
	return cli.Command{
		Name:  "migrate-quill-to-markdown",
		Usage: "convert existing Quill delta JSON in DB columns to markdown (in-place)",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "dry-run",
				Usage: "scan + report counts but do not UPDATE rows",
			},
			cli.IntFlag{
				Name:  "limit",
				Usage: "maximum number of rows to update per table (0 = no limit)",
				Value: 0,
			},
		},
		Action: func(c *cli.Context) error {
			return runQuillToMarkdownBackfill(modelsDB(), c.Bool("dry-run"), c.Int("limit"))
		},
	}
}

func modelsDB() *sqlx.DB {
	// bootstrap() hydrates sociConfig + models DBConn.
	return sociConfig.DBConn
}

func runQuillToMarkdownBackfill(db *sqlx.DB, dryRun bool, limit int) error {
	jobs := []struct {
		table string
		idCol string
		col   string
	}{
		{"comments", "id", "content"},
		{"posts", "id", "content"},
		{"users", "id", "description"},
		{"communities", "id", "description"},
	}

	for _, j := range jobs {
		if err := backfillColumn(db, j.table, j.idCol, j.col, dryRun, limit); err != nil {
			return err
		}
	}

	return nil
}

type idValueRow struct {
	ID    int64  `db:"id"`
	Value string `db:"value"`
}

func backfillColumn(db *sqlx.DB, table, idCol, col string, dryRun bool, limit int) error {
	log(fmt.Sprintf("[migrate-quill-to-markdown] scanning %s.%s", table, col))

	q := fmt.Sprintf("SELECT %s AS id, %s AS value FROM %s", idCol, col, table)
	rows, err := db.Queryx(q)
	if err != nil {
		return err
	}
	defer rows.Close()

	toUpdate := make([]idValueRow, 0, 256)
	for rows.Next() {
		var r idValueRow
		if err := rows.StructScan(&r); err != nil {
			return err
		}
		raw := strings.TrimSpace(r.Value)
		if raw == "" || !looksLikeQuillDelta(raw) {
			continue
		}
		md, ok := quillDeltaJSONToMarkdown(raw)
		if !ok {
			continue
		}
		md = strings.TrimSpace(md)
		if md != "" {
			md += "\n"
		}
		if md == r.Value {
			continue
		}
		toUpdate = append(toUpdate, idValueRow{ID: r.ID, Value: md})
		if limit > 0 && len(toUpdate) >= limit {
			break
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	if len(toUpdate) == 0 {
		log(fmt.Sprintf("[migrate-quill-to-markdown] %s.%s: no rows to update", table, col))
		return nil
	}

	log(fmt.Sprintf("[migrate-quill-to-markdown] %s.%s: %d rows to update%s", table, col, len(toUpdate), func() string {
		if dryRun {
			return " (dry-run)"
		}
		return ""
	}()))

	if dryRun {
		return nil
	}

	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	uq := fmt.Sprintf("UPDATE %s SET %s = ? WHERE %s = ?", table, col, idCol)
	for _, r := range toUpdate {
		if _, err := tx.Exec(uq, r.Value, r.ID); err != nil {
			return err
		}
	}

	return tx.Commit()
}


