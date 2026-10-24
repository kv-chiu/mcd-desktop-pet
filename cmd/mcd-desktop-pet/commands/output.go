package commands

import (
	"encoding/json"
	"fmt"
	"os"
)

// PrintJSON writes data to os.Stdout formatted as JSON and exits with code 0.
func PrintJSON(data any) {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding JSON output: %v\n", err)
		os.Exit(1)
	}
}

// PrintErrorJSON writes an error object to os.Stdout formatted as JSON and exits with code 1.
func PrintErrorJSON(err error) {
	data := map[string]string{
		"error": err.Error(),
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	_ = encoder.Encode(data)
	os.Exit(1)
}

// PrintErrorMessage writes a string error message to os.Stdout formatted as JSON and exits with code 1.
func PrintErrorMessage(msg string) {
	data := map[string]string{
		"error": msg,
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	_ = encoder.Encode(data)
	os.Exit(1)
}
