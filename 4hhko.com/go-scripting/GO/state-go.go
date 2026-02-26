package main

import (
    "crypto/rand"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "os"
    "strconv"
)

func main() {
    contentLengthStr := os.Getenv("CONTENT_LENGTH")
    contentLength, _ := strconv.Atoi(contentLengthStr)
    
    bodyBytes := make([]byte, contentLength)
    io.ReadFull(os.Stdin, bodyBytes)
    bodyData := string(bodyBytes)
    
    params, _ := url.ParseQuery(bodyData)
    
    name := ""
    if val, ok := params["name"]; ok && len(val) > 0 {
        name = val[0]
    }
    
    favStudent := ""
    if val, ok := params["fav_student"]; ok && len(val) > 0 {
        favStudent = val[0]
    }
    
    reason := ""
    if val, ok := params["reason"]; ok && len(val) > 0 {
        reason = val[0]
    }
    
    b := make([]byte, 16)
    rand.Read(b)
    sessionID := hex.EncodeToString(b)
    
    sessionData := map[string]string{
        "name":        name,
        "fav_student": favStudent,
        "reason":      reason,
    }
    
    sessionFile := fmt.Sprintf("/tmp/session_%s.json", sessionID)
    jsonData, _ := json.Marshal(sessionData)
    os.WriteFile(sessionFile, jsonData, 0644)
    
    cookie := &http.Cookie{
        Name:   "session_id",
        Value:  sessionID,
        Path:   "/",
        MaxAge: 3600,
    }
    
    fmt.Println("Status: 302 Found")
    fmt.Println("Content-Type: text/html")
    fmt.Printf("Set-Cookie: %s\n", cookie.String())
    fmt.Println("Location: /cgi-bin/state-show-go")
    fmt.Println("")
    fmt.Println("<!DOCTYPE html><html><head><title></title></head><body></body></html>")
}
