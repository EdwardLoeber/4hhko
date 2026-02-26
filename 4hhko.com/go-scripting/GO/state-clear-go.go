package main

import (
    "fmt"
    "net/http"
    "os"
    "strings"
)

func main() {
    cookieHeader := os.Getenv("HTTP_COOKIE")
    
    var sessionID string
    
    if cookieHeader != "" {
        cookies := strings.Split(cookieHeader, "; ")
        for _, cookie := range cookies {
            parts := strings.SplitN(cookie, "=", 2)
            if len(parts) == 2 && parts[0] == "session_id" {
                sessionID = parts[1]
                break
            }
        }
    }
    
    if sessionID != "" {
        sessionFile := fmt.Sprintf("/tmp/session_%s.json", sessionID)
        os.Remove(sessionFile)
    }
    
    cookie := &http.Cookie{
        Name:   "session_id",
        Value:  "",
        Path:   "/",
        MaxAge: 0,
    }
    
    fmt.Println("Status: 302 Found")
    fmt.Println("Content-Type: text/html")
    fmt.Printf("Set-Cookie: %s\n", cookie.String())
    fmt.Println("Location: /cgi-bin/state-show-go")
    fmt.Println("")
    fmt.Println("<!DOCTYPE html><html><head><title></title></head><body></body></html>")
}
