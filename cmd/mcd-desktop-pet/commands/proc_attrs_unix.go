//go:build !windows

package commands

import (
	"os"
	"syscall"
)

var shutdownSignals = []os.Signal{os.Interrupt, syscall.SIGTERM}

func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		Setpgid: true,
	}
}

func isProcessAlive(p *os.Process) bool {
	return p.Signal(syscall.Signal(0)) == nil
}

func killProcess(p *os.Process) error {
	return p.Signal(syscall.SIGTERM)
}
