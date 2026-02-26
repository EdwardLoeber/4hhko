package main

import (
    "fmt"
    "os"
    "time"
)

func main() {
    fmt.Println("Content-Type: text/html\n")
    fmt.Println("<!DOCTYPE html>")
    fmt.Println("<html>")
    fmt.Println("<head><title>Hello CGI World - Go</title></head>")
    fmt.Println("<body>")
    fmt.Println("<h1>Hello HTML World</h1>")
    fmt.Println("<p>Team Members: Edward Loeber</p>")
    fmt.Println("<p>This page was generated with the Go programming language</p>")
    
    now := time.Now()
    fmt.Printf("<p>This program was generated at: %s</p>\n", now.Format("2006-01-02 15:04:05"))
    
    remoteAddr := os.Getenv("REMOTE_ADDR")
    fmt.Printf("<p>Your current IP Address is: %s</p>\n", remoteAddr)
    
    fmt.Println("</body>")
    fmt.Println("</html>")
}
