package main

import (
    "encoding/json"
    "fmt"
    "html"
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
    
    fmt.Println("Content-Type: text/html\n")
    fmt.Println("<!DOCTYPE html>")
    fmt.Println("<html>")
    fmt.Println("<head><title>Show State</title></head>")
    fmt.Println("<body>")
    fmt.Println("<h1>Saved State - Go </h1>")
    
    if sessionID != "" {
        sessionFile := fmt.Sprintf("/tmp/session_%s.json", sessionID)
        
        fileData, err := os.ReadFile(sessionFile)
        if err == nil {
            var data map[string]string
            json.Unmarshal(fileData, &data)
            
            fmt.Printf("<p>Name: %s</p>\n", html.EscapeString(data["name"]))
            fmt.Printf("<p>Favorite Student: %s</p>\n", html.EscapeString(data["fav_student"]))
            fmt.Printf("<p>Reason: %s</p>\n", html.EscapeString(data["reason"]))
        } else {
            fmt.Println("<p>No session data found</p>")
        }
    } else {
        fmt.Println("<p>No session found</p>")
    }
    
    fmt.Println("<a href='/cgi-bin/state-show-go'>Page 1</a><br><br>")
    fmt.Println("<a href='/cgi-bin/state-clear-go'>Delete Session</a><br><br>")
    fmt.Println("<a href='/pages/homeworks/hw2/state-save.html'>CGI Form</a><br><br>")
    fmt.Println("</body>")
    fmt.Println("</html>")
}
