package main

import (
    "fmt"
    "html"
    "os"
    "sort"
    "strings"
)

func main() {
    fmt.Println("Content-Type: text/html\n")
    fmt.Println("<!DOCTYPE html>")
    fmt.Println("<html>")
    fmt.Println("<head><title>Environment Variables</title></head>")
    fmt.Println("<body>")
    fmt.Println("<h1 align='center'>Environment Variables</h1>")
    fmt.Println("<hr>")
    
    environ := os.Environ()
    
    sort.Strings(environ)
    
    for _, env := range environ {
        parts := strings.SplitN(env, "=", 2)
        if len(parts) == 2 {
            key := html.EscapeString(parts[0])
            value := html.EscapeString(parts[1])
            fmt.Printf("<b>%s:</b> %s\n<br>", key, value)
        } else {
            fmt.Printf("%s\n<br>", html.EscapeString(env))
        }
    }

    fmt.Println("</body>")
    fmt.Println("</html>")
}
