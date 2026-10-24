//go:build !windows

package embedder

import (
	"os"
	"syscall"
)

func isProcessRunning(p *os.Process) bool {
	return p.Signal(syscall.Signal(0)) == nil
}

func terminateProcess(p *os.Process) error {
	return p.Signal(syscall.SIGTERM)
}

func getDesktopSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		Setpgid: true,
	}
}
