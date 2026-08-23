# Color Token Levels
1. type
   1. base
   1. brand
   1. success
   1. error
 
1. objects
   1. background
   1. shadow
   1. text

1. level
   1. default
   1. subtle
   1. bold
   1. inverse

1. variants
   1. default
   1. hover
   1. active

    
# Schema

    type | object | level | variant

i.e.

    text-bold-hover

## Rules
### Defaults
Defaults are implicit and aren't needed in the token name:

YES: 

    bg-brand-secondary

NO:  

    bg-brand-secondary-default

### Undefined tokens
If a token is undefined, it falls back to the nearest default value
i.e.

    text-danger-bold-hover --> text-danger-bold

# Example
![Token Example](/docs/tokens/tokens.png)