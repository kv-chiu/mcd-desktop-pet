package commands

import (
	"fmt"

	"github.com/spf13/cobra"

	"mcd-desktop-pet/internal/notes"
	"mcd-desktop-pet/internal/storage"
)

type NoteListItem struct {
	ID      string `json:"id"`
	Summary string `json:"summary"`
	Status  string `json:"status"`
}

// NewNoteCommand returns the note command with subcommands.
func NewNoteCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "note",
		Short: "Manage desktop sticky notes",
	}

	cmd.AddCommand(newNoteCreateCmd())
	cmd.AddCommand(newNoteListCmd())
	cmd.AddCommand(newNoteDeleteCmd())
	cmd.AddCommand(newNoteArchiveCmd())
	cmd.AddCommand(newNoteRestoreCmd())

	return cmd
}

func getNotesManager() (*notes.Manager, error) {
	fs, err := storage.NewFileStore("")
	if err != nil {
		return nil, err
	}
	return notes.NewManager(fs)
}

func newNoteCreateCmd() *cobra.Command {
	var text string
	var title string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new sticky note",
		Run: func(cmd *cobra.Command, args []string) {
			if text == "" {
				PrintErrorMessage("--text is required to create a note")
				return
			}

			// If server is running, use HTTP API to trigger WS broadcast
			fs, _ := storage.NewFileStore("")
			port := GetActiveServerPort(fs)
			if IsServerRunning(port) {
				var created notes.Note
				err := DoServerRequest("POST", "/api/notes", map[string]any{
					"title":   title,
					"content": text,
				}, &created)
				if err != nil {
					PrintErrorJSON(err)
					return
				}
				PrintJSON(NoteListItem{
					ID:      created.ID,
					Summary: created.Summary(),
					Status:  string(created.Status),
				})
				return
			}

			// Direct storage fallback
			mgr, err := getNotesManager()
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			note, err := mgr.CreateNote(notes.CreateNoteRequest{
				Title:   title,
				Content: text,
			})
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			PrintJSON(NoteListItem{
				ID:      note.ID,
				Summary: note.Summary(),
				Status:  string(note.Status),
			})
		},
	}

	cmd.Flags().StringVar(&text, "text", "", "Text content of the note (required)")
	cmd.Flags().StringVar(&title, "title", "", "Optional title of the note")
	_ = cmd.MarkFlagRequired("text")

	return cmd
}

func newNoteListCmd() *cobra.Command {
	var status string

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List sticky notes filtered by status",
		Run: func(cmd *cobra.Command, args []string) {
			if status == "" {
				status = "active"
			}
			if status != "active" && status != "archived" && status != "all" {
				PrintErrorMessage("invalid status: must be 'active', 'archived', or 'all'")
				return
			}

			mgr, err := getNotesManager()
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			list, err := mgr.ListNotes(notes.NoteStatus(status))
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			items := make([]NoteListItem, 0, len(list))
			for _, n := range list {
				items = append(items, NoteListItem{
					ID:      n.ID,
					Summary: n.Summary(),
					Status:  string(n.Status),
				})
			}

			PrintJSON(items)
		},
	}

	cmd.Flags().StringVar(&status, "status", "active", "Filter by status: active / archived / all")

	return cmd
}

func newNoteDeleteCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "delete <id>",
		Short: "Delete a note permanently",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			id := args[0]

			fs, _ := storage.NewFileStore("")
			port := GetActiveServerPort(fs)
			if IsServerRunning(port) {
				var res map[string]any
				err := DoServerRequest("DELETE", fmt.Sprintf("/api/notes/%s", id), nil, &res)
				if err != nil {
					PrintErrorJSON(err)
					return
				}
				PrintJSON(map[string]any{
					"id":      id,
					"deleted": true,
				})
				return
			}

			mgr, err := getNotesManager()
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			if err := mgr.DeleteNote(id); err != nil {
				PrintErrorJSON(err)
				return
			}

			PrintJSON(map[string]any{
				"id":      id,
				"deleted": true,
			})
		},
	}
}

func newNoteArchiveCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "archive <id>",
		Short: "Archive a note (mark done)",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			id := args[0]

			fs, _ := storage.NewFileStore("")
			port := GetActiveServerPort(fs)
			if IsServerRunning(port) {
				var note notes.Note
				err := DoServerRequest("POST", fmt.Sprintf("/api/notes/%s/archive", id), nil, &note)
				if err != nil {
					PrintErrorJSON(err)
					return
				}
				PrintJSON(NoteListItem{
					ID:      note.ID,
					Summary: note.Summary(),
					Status:  string(note.Status),
				})
				return
			}

			mgr, err := getNotesManager()
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			note, err := mgr.ArchiveNote(id)
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			PrintJSON(NoteListItem{
				ID:      note.ID,
				Summary: note.Summary(),
				Status:  string(note.Status),
			})
		},
	}
}

func newNoteRestoreCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "restore <id>",
		Short: "Restore an archived note back to active desk",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			id := args[0]

			fs, _ := storage.NewFileStore("")
			port := GetActiveServerPort(fs)
			if IsServerRunning(port) {
				var note notes.Note
				err := DoServerRequest("POST", fmt.Sprintf("/api/notes/%s/restore", id), nil, &note)
				if err != nil {
					PrintErrorJSON(err)
					return
				}
				PrintJSON(NoteListItem{
					ID:      note.ID,
					Summary: note.Summary(),
					Status:  string(note.Status),
				})
				return
			}

			mgr, err := getNotesManager()
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			note, err := mgr.RestoreNote(id)
			if err != nil {
				PrintErrorJSON(err)
				return
			}

			PrintJSON(NoteListItem{
				ID:      note.ID,
				Summary: note.Summary(),
				Status:  string(note.Status),
			})
		},
	}
}
