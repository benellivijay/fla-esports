/**
 * FLA ESPORTS - Google Apps Script Backend Storage Webhook
 * 
 * Instructions:
 * 1. Open Google Drive (https://drive.google.com).
 * 2. Click "New" > "More" > "Google Apps Script".
 * 3. Paste this script into the editor.
 * 4. Replace FOLDER_ID below with your Google Drive Folder ID: "1aR8N0GpxbdNFbY-u24iFvW145vjR0MhO".
 * 5. Click "Deploy" > "New deployment" > Select type "Web app".
 * 6. Set "Execute as: Me", "Who has access: Anyone".
 * 7. Copy the Web App URL and add to your backend environment: GDRIVE_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
 */

const DEFAULT_FOLDER_ID = "1aR8N0GpxbdNFbY-u24iFvW145vjR0MhO";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const folderId = body.folderId || DEFAULT_FOLDER_ID;
    const fileName = body.fileName;
    const fileData = body.fileData; // base64 encoded
    const mimeType = body.mimeType || "application/json";

    const folder = DriveApp.getFolderById(folderId);
    const decodedBytes = Utilities.base64Decode(fileData);
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // Check if file already exists in folder
    const existingFiles = folder.getFilesByName(fileName);
    let targetFile;
    if (existingFiles.hasNext()) {
      targetFile = existingFiles.next();
      targetFile.setContent(blob.getDataAsString());
    } else {
      targetFile = folder.createFile(blob);
    }

    targetFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: targetFile.getId(),
      fileUrl: targetFile.getUrl(),
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const folderId = (e.parameter && e.parameter.folderId) || DEFAULT_FOLDER_ID;
    const fileName = (e.parameter && e.parameter.fileName) || "players_registry.json";

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(fileName);

    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      const base64 = Utilities.base64Encode(content);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileName: fileName,
        fileContent: base64
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "File not found in folder."
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
