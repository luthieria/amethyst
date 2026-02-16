import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import subprocess

# === CONFIG ===
SERVICE_ACCOUNT_FILE = 'hugo-sync-bf3479717a86.json'
DOCUMENT_ID = '1ZVkb8a9hMjGRV-00omeyUvhPYv0AIBf_d8cmOaaGGnA'
OUTPUT_DOCX = 'temp.docx'
OUTPUT_MD = 'content/Notas/I. Ciencia/7. Música/1. Etnomusicología/4. América/4.1. América Latina/4.1.1. Hispanoamérica/Puerto Rico/Música puertorriqueña.md'

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

# === AUTH ===
creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

drive_service = build('drive', 'v3', credentials=creds)

# === EXPORT DOC AS DOCX ===
request = drive_service.files().export_media(
    fileId=DOCUMENT_ID,
    mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
)

fh = io.FileIO(OUTPUT_DOCX, 'wb')
downloader = MediaIoBaseDownload(fh, request)

done = False
while not done:
    status, done = downloader.next_chunk()

fh.close()

# === CONVERT TO MARKDOWN ===
subprocess.run([
    'pandoc',
    OUTPUT_DOCX,
    '-o',
    OUTPUT_MD,
    '--wrap=none'
])

print("Sync complete.")