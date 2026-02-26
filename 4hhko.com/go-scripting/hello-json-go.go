package main

import (
    "encoding/json"
    "fmt"
    "os"
    "time"
)

func main() {
    data := map[string]string{
        "title":        "Hello, Go!",
        "heading": "Hello, Go!",
        "message":     "This page was generated with the go programming language",
        "time": time.Now().Format("2006-01-02 15:04:05"),
        "IP":      os.Getenv("REMOTE_ADDR"),
    }
    
    jsonData, err := json.MarshalIndent(data, "", "    ")
    if err != nil {
        fmt.Println("Content-Type: text/plain\n")
        fmt.Println("Error generating JSON")
        return
    }

    fmt.Println("Content-Type: application/json\n")
    fmt.Println(string(jsonData))
}
