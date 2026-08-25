package encode

import (
	"bytes"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// heicFile builds the ftyp box of a HEIC still: a box length, the "ftyp" tag,
// a major brand, a minor version and any compatible brands.
func heicFile(major string, compatible ...string) []byte {
	body := []byte("ftyp" + major + "\x00\x00\x00\x00" + strings.Join(compatible, ""))
	return append([]byte{0, 0, 0, byte(len(body) + 4)}, body...)
}

// workspace gives the encoder the files/ tree it writes into, in a temp dir.
func workspace(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	for _, sub := range []string{"files/temp-images", "files/images", "files/thumbnails"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0755); err != nil {
			t.Fatal(err)
		}
	}
	previous, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Chdir(previous) })
	return dir
}

// recordCommands swaps the exec seam for one that records what would have run.
func recordCommands(t *testing.T) *[][]string {
	t.Helper()
	var ran [][]string
	execCommand = func(name string, args ...string) *exec.Cmd {
		ran = append(ran, append([]string{name}, args...))
		return exec.Command("true")
	}
	t.Cleanup(func() { execCommand = exec.Command })
	return &ran
}

func TestIsHEIFRecognizesTheBrandsCamerasWrite(t *testing.T) {
	heif := map[string][]byte{
		"iPhone still":        heicFile("heic", "mif1", "heic"),
		"burst still":         heicFile("heix", "mif1", "heix"),
		"brandless container": heicFile("mif1", "mif1", "heic"),
		"compatible only":     heicFile("isom", "mif1", "heic"),
	}
	for name, buf := range heif {
		if !isHEIF(buf) {
			t.Errorf("%v should be detected as HEIC/HEIF", name)
		}
	}

	other := map[string][]byte{
		"mp4":       heicFile("isom", "isom", "mp42"),
		"jpeg":      {0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0},
		"too short": []byte("ftyp"),
		"text":      []byte("this is not an image at all"),
	}
	for name, buf := range other {
		if isHEIF(buf) {
			t.Errorf("%v should not be detected as HEIC/HEIF", name)
		}
	}
}

func TestImageMIMEReportsHEICAsHEIF(t *testing.T) {
	mime, err := imageMIME(heicFile("heic", "mif1", "heic"))
	if err != nil {
		t.Fatalf("A HEIC upload should be accepted. Error: %v", err)
	}
	if mime != "image/heif" {
		t.Errorf("Expected image/heif, got %q", mime)
	}
}

func TestImageMIMERejectsNonImages(t *testing.T) {
	if _, err := imageMIME([]byte("<html>not an image</html>")); err == nil {
		t.Error("A non-image upload should be rejected")
	}
}

func TestEncodeCommandsOnlyEverWritesWebp(t *testing.T) {
	for _, mime := range []string{"image/heif", "image/jpeg", "image/png", "image/gif", "image/tiff"} {
		for _, args := range encodeCommands(mime, "files/temp-images/image-1", "my-post") {
			for _, arg := range args {
				if strings.Contains(arg, ".heic") || strings.Contains(arg, ".heif") {
					t.Errorf("%v encoding should not touch HEIC, got %v", mime, args)
				}
			}
		}
	}
}

func TestEncodeCommandsGivesHEICTheSameSettingsAsAnyOtherPhoto(t *testing.T) {
	heic := encodeCommands("image/heif", "files/temp-images/image-1", "my-post")
	jpeg := encodeCommands("image/jpeg", "files/temp-images/image-1", "my-post")
	if !reflect.DeepEqual(heic, jpeg) {
		t.Errorf("HEIC should reuse the existing photo settings.\n heic: %v\n jpeg: %v", heic, jpeg)
	}
}

func TestImageTranscodesHEICUploadsToWebp(t *testing.T) {
	workspace(t)
	ran := recordCommands(t)

	if err := Image(bytes.NewReader(heicFile("heic", "mif1", "heic")), "my-post"); err != nil {
		t.Fatalf("A HEIC upload should encode. Error: %v", err)
	}

	if len(*ran) != 1 {
		t.Fatalf("Expected a single convert, got %v", *ran)
	}
	command := strings.Join((*ran)[0], " ")
	for _, want := range []string{"convert", "files/thumbnails/my-post.webp", "files/images/my-post.webp"} {
		if !strings.Contains(command, want) {
			t.Errorf("Expected %q in the encode command, got %v", want, command)
		}
	}
	if strings.Contains(command, "heic") || strings.Contains(command, "heif") {
		t.Errorf("The HEIC upload should leave nothing but webp behind, got %v", command)
	}
}

func TestImageRejectsUploadsThatArentImages(t *testing.T) {
	workspace(t)
	ran := recordCommands(t)

	if err := Image(strings.NewReader("nope"), "my-post"); err == nil {
		t.Error("A non-image upload should be rejected")
	}
	if len(*ran) != 0 {
		t.Errorf("Nothing should be encoded for a rejected upload, got %v", *ran)
	}
}

// TestImageEncodesRealHEICWhenTheToolchainIsInstalled is the end to end check:
// imagemagick reads the HEIC and hands back a webp image and thumbnail.
func TestImageEncodesRealHEICWhenTheToolchainIsInstalled(t *testing.T) {
	if _, err := exec.LookPath("convert"); err != nil {
		t.Skip("imagemagick is not installed")
	}
	if _, err := exec.LookPath("heif-enc"); err != nil {
		t.Skip("heif-enc is not installed, cannot build a HEIC fixture")
	}
	dir := workspace(t)

	png := filepath.Join(dir, "fixture.png")
	heic := filepath.Join(dir, "fixture.heic")
	if out, err := exec.Command("convert", "-size", "320x240", "gradient:red-blue", png).CombinedOutput(); err != nil {
		t.Skipf("could not build a png fixture: %v: %s", err, out)
	}
	if out, err := exec.Command("heif-enc", png, "-o", heic).CombinedOutput(); err != nil {
		t.Skipf("could not build a HEIC fixture: %v: %s", err, out)
	}

	upload, err := os.Open(heic)
	if err != nil {
		t.Fatal(err)
	}
	defer upload.Close()

	if err := Image(upload, "my-post"); err != nil {
		t.Fatalf("A real HEIC upload should encode. Error: %v", err)
	}

	for _, written := range []string{"files/images/my-post.webp", "files/thumbnails/my-post.webp"} {
		encoded, err := ioutil.ReadFile(filepath.Join(dir, written))
		if err != nil {
			t.Fatalf("Expected %v to exist. Error: %v", written, err)
		}
		if len(encoded) < 12 || string(encoded[0:4]) != "RIFF" || string(encoded[8:12]) != "WEBP" {
			t.Errorf("%v should be a webp of %v bytes", written, len(encoded))
		}
	}
	for _, forbidden := range []string{"files/images/my-post.heic", "files/thumbnails/my-post.heic"} {
		if _, err := os.Stat(filepath.Join(dir, forbidden)); err == nil {
			t.Errorf("%v should not be written any more", forbidden)
		}
	}
}
