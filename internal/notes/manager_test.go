package notes

import (
	"os"
	"testing"

	"mcd-desktop-pet/internal/storage"
)

func TestNotesManager(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mcd-test-notes-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	fs, err := storage.NewFileStore(tempDir)
	if err != nil {
		t.Fatalf("failed to init FileStore: %v", err)
	}

	mgr, err := NewManager(fs)
	if err != nil {
		t.Fatalf("failed to init Manager: %v", err)
	}

	// 1. Create notes
	n1, err := mgr.CreateNote(CreateNoteRequest{
		Title:   "买麦辣鸡腿堡",
		Content: "记得加冰可乐和大薯",
	})
	if err != nil {
		t.Fatalf("CreateNote n1 failed: %v", err)
	}

	n2, err := mgr.CreateNote(CreateNoteRequest{
		Title:   "下午 3 点会议",
		Content: "与架构组讨论 Go 重构",
	})
	if err != nil {
		t.Fatalf("CreateNote n2 failed: %v", err)
	}

	// 2. List active
	activeNotes, err := mgr.ListNotes(StatusActive)
	if err != nil || len(activeNotes) != 2 {
		t.Fatalf("expected 2 active notes, got %d, err: %v", len(activeNotes), err)
	}

	// 3. Archive n1
	archived, err := mgr.ArchiveNote(n1.ID)
	if err != nil || archived.Status != StatusArchived || archived.ArchivedAt == nil {
		t.Fatalf("ArchiveNote failed: %v", err)
	}

	// Verify counts
	activeNotes, _ = mgr.ListNotes(StatusActive)
	if len(activeNotes) != 1 {
		t.Errorf("expected 1 active note after archive, got %d", len(activeNotes))
	}
	archivedNotes, _ := mgr.ListNotes(StatusArchived)
	if len(archivedNotes) != 1 {
		t.Errorf("expected 1 archived note, got %d", len(archivedNotes))
	}
	allNotes, _ := mgr.ListNotes(StatusAll)
	if len(allNotes) != 2 {
		t.Errorf("expected 2 total notes, got %d", len(allNotes))
	}

	// 4. Restore n1
	restored, err := mgr.RestoreNote(n1.ID)
	if err != nil || restored.Status != StatusActive || restored.ArchivedAt != nil {
		t.Fatalf("RestoreNote failed: %v", err)
	}
	activeNotes, _ = mgr.ListNotes(StatusActive)
	if len(activeNotes) != 2 {
		t.Errorf("expected 2 active notes after restore, got %d", len(activeNotes))
	}

	// 5. Update position & size
	if err := mgr.UpdatePositionSize(n1.ID, [2]int{100, 200}, [2]int{300, 400}); err != nil {
		t.Fatalf("UpdatePositionSize failed: %v", err)
	}
	checkN1, _ := mgr.GetNote(n1.ID)
	if checkN1.Position != [2]int{100, 200} || checkN1.Size != [2]int{300, 400} {
		t.Errorf("position/size not updated: pos=%v size=%v", checkN1.Position, checkN1.Size)
	}

	// 6. Test persistence across manager reload
	mgr2, err := NewManager(fs)
	if err != nil {
		t.Fatalf("reload Manager failed: %v", err)
	}
	reloadedNotes, err := mgr2.ListNotes(StatusAll)
	if err != nil || len(reloadedNotes) != 2 {
		t.Fatalf("reloaded manager expected 2 notes, got %d, err: %v", len(reloadedNotes), err)
	}

	// 7. Delete note
	if err := mgr2.DeleteNote(n2.ID); err != nil {
		t.Fatalf("DeleteNote failed: %v", err)
	}
	afterDelete, _ := mgr2.ListNotes(StatusAll)
	if len(afterDelete) != 1 {
		t.Errorf("expected 1 note after delete, got %d", len(afterDelete))
	}
}
