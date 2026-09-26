param(
    [string]$Service = ""
)

node "$PSScriptRoot\scripts\dev.js" $Service
