package main

import (
    "encoding/json"
    "fmt"
    "html"
    "io"
    "net/url"
    "os"
    "strconv"
    "strings"
    "time"
)

func main() {
    method := os.Getenv("REQUEST_METHOD")
    contentType := os.Getenv("CONTENT_TYPE")
    queryString := os.Getenv("QUERY_STRING")
    
    var bodyData string
    var rawData string
    var parsedData interface{}
    
    if method == "POST" || method == "PUT" || method == "DELETE" {
        contentLengthStr := os.Getenv("CONTENT_LENGTH")
        contentLength, _ := strconv.Atoi(contentLengthStr)
        
        if contentLength > 0 {
            bodyBytes := make([]byte, contentLength)
            io.ReadFull(os.Stdin, bodyBytes)
            bodyData = string(bodyBytes)
        }
    }
    
    if method == "GET" {
        rawData = queryString
        values, _ := url.ParseQuery(queryString)
        parsedData = values
    } else {
        rawData = bodyData
        if strings.Contains(contentType, "application/json") {
            var jsonData map[string]interface{}
            err := json.Unmarshal([]byte(bodyData), &jsonData)
            if err != nil {
                parsedData = map[string]string{"error": "Invalid JSON"}
            } else {
                parsedData = jsonData
            }
        } else {
            values, _ := url.ParseQuery(bodyData)
            parsedData = values
        }
    }
    
    parsedJSON, _ := json.MarshalIndent(parsedData, "", "    ")
    
    fmt.Println("Content-Type: text/html\n")
    fmt.Println("<!DOCTYPE html>")
    fmt.Println("<html>")
    fmt.Println("<head><title>Echo - Go</title></head>")
    fmt.Println("<body>")
    fmt.Println("<h1>Echo - Go</h1>")
    fmt.Printf("<p>Method: %s</p>\n", html.EscapeString(method))
    fmt.Printf("<p>Encoding method: %s</p>\n", html.EscapeString(contentType))
    fmt.Printf("<p>Hostname: %s</p>\n", html.EscapeString(os.Getenv("SERVER_NAME")))
    fmt.Printf("<p>Date and Time: %s</p>\n", time.Now().Format("2006-01-02 15:04:05"))
    fmt.Printf("<p>User Agent: %s</p>\n", html.EscapeString(os.Getenv("HTTP_USER_AGENT")))
    fmt.Printf("<p>IP: %s</p>\n", os.Getenv("REMOTE_ADDR"))
    fmt.Println("<h2>Raw Data</h2>")
    fmt.Printf("<pre>%s</pre>\n", html.EscapeString(rawData))
    fmt.Println("<h2>Parsed Data</h2>")
    fmt.Printf("<pre>%s</pre>\n", html.EscapeString(string(parsedJSON)))
    fmt.Println("</body>")
    fmt.Println("</html>")
}
