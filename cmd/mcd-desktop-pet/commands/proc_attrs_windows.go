//go:build windows

package commands

import (
	"os"
	"syscall"
)

var shutdownSignals = []os.Signal{os.Interrupt}

func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{}
}

func isProcessAlive(p *os.Process) bool {
	return p != nil
}

func killProcess(p *os.Process) error {
	return p.Kill()
}
