package main

import (
    "fmt"
)

func main() {
    fmt.Println("Content-Type: text/html")
    fmt.Println("")
    fmt.Println("<html>")
    fmt.Println("<head><title>Go CGI</title></head>")
    fmt.Println("<body>")
    fmt.Println("<h1>Hello from Go CGI!</h1>")
    fmt.Println("<p>The Dao compiles swiftly through this path.</p>")
    fmt.Println("</body>")
    fmt.Println("</html>")
}
