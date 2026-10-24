//go:build windows

package embedder

import (
	"os"
	"syscall"
)

func isProcessRunning(p *os.Process) bool {
	return p != nil
}

func terminateProcess(p *os.Process) error {
	return p.Kill()
}

func getDesktopSysProcAttr() *syscall.SysProcAttr {
	return nil
}
