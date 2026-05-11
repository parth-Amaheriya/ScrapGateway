$baseUrl = "http://127.0.0.1:8000/api/projects"

Write-Host "--- Step 1: GET projects ---"
try {
    $getResponse = Invoke-WebRequest -Uri $baseUrl -Method Get
    Write-Host "Status: $($getResponse.StatusCode)"
    Write-Host "Body: $($getResponse.Content)"
    $data = $getResponse.Content | ConvertFrom-Json
    if ($data.Count -gt 0) {
        Write-Host "First Project ID: $($data[0].id)"
    } else {
        Write-Host "No projects found."
    }
} catch {
    Write-Host "Step 1 Failed"
    Write-Host "Exception: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Error Body: $($reader.ReadToEnd())"
    }
}

Write-Host "--- Step 2: POST new project ---"
$postPayload = @{
    name = "Test Project"
    allowed_domains = @("amazon.com", "google.com", "openai.com")
}
try {
    $postResponse = Invoke-WebRequest -Uri $baseUrl -Method Post -Body ($postPayload | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Status: $($postResponse.StatusCode)"
    Write-Host "Body: $($postResponse.Content)"
    $newProject = $postResponse.Content | ConvertFrom-Json
    $projectId = $newProject.id

    Write-Host "--- Step 3: PATCH created project ---"
    $patchPayload = @{
        allowed_domains = @("amazon.com", "google.com", "openai.com")
    }
    $patchResponse = Invoke-WebRequest -Uri "$baseUrl/$projectId/" -Method Patch -Body ($patchPayload | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Status: $($patchResponse.StatusCode)"
    Write-Host "Body: $($patchResponse.Content)"

    Write-Host "--- Step 4: GET created project ---"
    $getFinal = Invoke-RestMethod -Uri "$baseUrl/$projectId/" -Method Get
    Write-Host "Saved allowed_domains: $($getFinal.allowed_domains -join ', ')"
} catch {
    Write-Host "Step Failed"
    Write-Host "Exception: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Error Body: $($reader.ReadToEnd())"
    }
}
