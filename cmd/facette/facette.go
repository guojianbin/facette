package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/facette/facette/pkg/config"
	"github.com/facette/facette/pkg/server"
	"github.com/facette/facette/pkg/utils"
)

const (
	cmdUsage = "Usage: %s [OPTIONS]"
)

var (
	flagConfig string
	flagDebug  int
	flagHelp   bool
)

func init() {
	flag.StringVar(&flagConfig, "c", config.DefaultConfigFile, "configuration file path")
	flag.IntVar(&flagDebug, "d", 0, "debugging level")
	flag.BoolVar(&flagHelp, "h", false, "display this help and exit")
	flag.Usage = func() { utils.PrintUsage(os.Stderr, cmdUsage) }
	flag.Parse()

	if flagHelp {
		utils.PrintUsage(os.Stdout, cmdUsage)
	} else if flagConfig == "" {
		fmt.Fprintf(os.Stderr, "Error: configuration file path is mandatory\n")
		utils.PrintUsage(os.Stderr, cmdUsage)
	}
}

func main() {
	// Create new server instance and load configuration
	instance, err := server.NewServer(flagDebug)
	if err != nil {
		fmt.Println("Error: " + err.Error())
		os.Exit(1)
	} else if err := instance.LoadConfig(flagConfig); err != nil {
		fmt.Println("Error: " + err.Error())
		os.Exit(1)
	}

	// Create .pid file
	if instance.Config.PidFile != "" {
		fd, err := os.OpenFile(instance.Config.PidFile, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
		if err != nil {
			fmt.Println("Error: " + err.Error())
			os.Exit(1)
		}

		defer fd.Close()

		fd.Write([]byte(strconv.Itoa(os.Getpid()) + "\n"))
	}

	// Reload server configuration on SIGHUP
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGHUP, syscall.SIGTERM)

	go func() {
		for sig := range sigChan {
			switch sig {
			case syscall.SIGHUP:
				instance.Reload()
				break

			case syscall.SIGINT, syscall.SIGTERM:
				instance.Stop()
				break
			}
		}
	}()

	// Run instance
	if err = instance.Run(); err != nil {
		fmt.Println("Error: " + err.Error())
		os.Exit(1)
	}

	if instance.Config.PidFile != "" {
		if err = os.Remove(instance.Config.PidFile); err != nil {
			fmt.Println("Error: " + err.Error())
			os.Exit(1)
		}
	}

	os.Exit(0)
}
