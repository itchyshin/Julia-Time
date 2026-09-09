# Protocol: pure functions for the WebSocket JSON messages and static-file serving. No I/O here
# — see docs/design/01-architecture.md §3-4 for the shapes; server.jl wires these to HTTP.jl.

using JSON

"""
    parse_message(s::AbstractString) -> Dict{String,Any}

Parse a client message. Throws if `s` is not valid JSON or the result has no `"type"` key.
"""
function parse_message(s::AbstractString)
    d = JSON.parse(s)
    d isa AbstractDict && haskey(d, "type") || error("message has no \"type\"")
    return Dict{String,Any}(d)
end

"""
    encode(d::AbstractDict) -> String

Encode a server message as JSON.
"""
encode(d::AbstractDict) = JSON.json(d)

"""
    content_type(path) -> String

Guess the HTTP Content-Type from a file extension.
"""
function content_type(path)
    ext = lowercase(splitext(path)[2])
    ext == ".html" && return "text/html"
    ext == ".js"   && return "text/javascript"
    ext == ".css"  && return "text/css"
    ext == ".json" && return "application/json"
    ext == ".png"  && return "image/png"
    ext == ".svg"  && return "image/svg+xml"
    return "application/octet-stream"
end

"""
    safe_web_path(target::AbstractString, webroot::AbstractString) -> Union{String,Nothing}

Map a request target to an absolute file path under `webroot`. `"/"` maps to `index.html`; a
query string is stripped. Returns `nothing` if the resolved path escapes `webroot` or does not
exist as a file.
"""
function safe_web_path(target::AbstractString, webroot::AbstractString)
    path = first(split(target, '?'; limit=2))
    path == "/" && (path = "/index.html")
    root = normpath(abspath(webroot))
    full = normpath(joinpath(root, lstrip(path, '/')))
    (full == root || startswith(full, root * "/")) || return nothing
    isfile(full) || return nothing
    return full
end
