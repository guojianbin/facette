package template

import (
	"bytes"
	"fmt"
	"sort"
	"text/template/parse"

	"github.com/fatih/set"
)

// Expand parses a given string replacing template keys with attributes values.
func Expand(data string, attrs map[string]interface{}) (string, error) {
	buf := bytes.NewBuffer(nil)

	// Parse response for template keys
	trees, err := parse.Parse("inline", data, "", "")
	if err != nil {
		return "", ErrInvalidTemplate
	}

	for _, node := range trees["inline"].Root.Nodes {
		if text, ok := node.(*parse.TextNode); ok {
			buf.Write(text.Text)
		} else if action, ok := node.(*parse.ActionNode); ok {
			if len(action.Pipe.Cmds) != 1 {
				continue
			}

			for _, arg := range action.Pipe.Cmds[0].Args {
				if field, ok := arg.(*parse.FieldNode); ok {
					if len(field.Ident) == 1 {
						// Replace template key with attribute value
						if v, ok := attrs[field.Ident[0]]; ok && v != nil {
							buf.WriteString(fmt.Sprintf("%v", v))
						}
					} else {
						return "", ErrInvalidTemplate
					}
				}
			}
		}
	}

	return buf.String(), nil
}

// Parse parses a given string, returning the list of template keys.
func Parse(data string) ([]string, error) {
	// Parse response for template keys
	trees, err := parse.Parse("inline", data, "", "")
	if err != nil {
		return nil, err
	}

	keys := set.New()
	for _, node := range trees["inline"].Root.Nodes {
		if action, ok := node.(*parse.ActionNode); ok {
			if len(action.Pipe.Cmds) != 1 {
				continue
			}

			for _, arg := range action.Pipe.Cmds[0].Args {
				if field, ok := arg.(*parse.FieldNode); ok {
					if len(field.Ident) == 1 {
						// Found a new key, add it to the results list
						keys.Add(field.Ident[0])
					} else {
						return nil, ErrInvalidTemplate
					}
				}
			}
		}
	}

	result := set.StringSlice(keys)
	sort.Strings(result)

	return result, nil
}
