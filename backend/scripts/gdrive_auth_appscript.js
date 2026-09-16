/**
 * FLA ESPORTS - Google Apps Script Backend Storage Webhook
 * 
 * Instructions to Deploy / Update:
 * 1. Open Google Drive (https://drive.google.com).
 * 2. Open your existing Apps Script project at https://script.google.com (or click "+ New" > "More" > "Google Apps Script").
 * 3. Replace all existing code in the editor with this script.
 * 4. Click "Deploy" > "Manage deployments" (or "New deployment").
 * 5. Click the Edit pencil icon (or New deployment > Select type "Web app"):
 *    - Description: "FLA Esports Resilient Cloud Storage"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (CRITICAL: this must be "Anyone", NOT "Only myself")
 * 6. Click "Deploy" and authorize any requested permissions ("Advanced" > "Go to ... (unsafe)" > "Allow").
 * 7. Copy the Web App URL (ends in /exec) and verify/set it in Render backend environment:
 *    GDRIVE_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
 */

const STORAGE_FOLDER_NAME = "FLA_Esports_Storage";

/**
 * Resilient folder resolution:
 * Tries the requested folderId; if invalid or inaccessible, automatically finds or creates
 * a dedicated folder named "FLA_Esports_Storage" in the deploying user's Drive.
 */
function getStorageFolder(folderId) {
  if (folderId && typeof folderId === "string" && folderId.trim() !== "" && folderId !== "root" && folderId !== "default") {
    try {
      var f = DriveApp.getFolderById(folderId.trim());
      if (f) return f;
    } catch (err) {
      // Inaccessible folder ID, fallback automatically
    }
  }

  // Find or create FLA_Esports_Storage folder in the user's Drive
  var folders = DriveApp.getFoldersByName(STORAGE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(STORAGE_FOLDER_NAME);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing POST body contents"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var body = JSON.parse(e.postData.contents);
    var folder = getStorageFolder(body.folderId);
    var fileName = body.fileName;
    var fileData = body.fileData; // base64 encoded
    var mimeType = body.mimeType || "application/json";

    if (!fileName || !fileData) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing fileName or fileData"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var decodedBytes = Utilities.base64Decode(fileData);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // Upsert file in folder
    var existingFiles = folder.getFilesByName(fileName);
    var targetFile;
    if (existingFiles.hasNext()) {
      targetFile = existingFiles.next();
      targetFile.setContent(blob.getDataAsString());
    } else {
      targetFile = folder.createFile(blob);
    }

    try {
      targetFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (_) {}

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      folderId: folder.getId(),
      folderName: folder.getName(),
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
    var folderId = e && e.parameter ? e.parameter.folderId : null;
    var fileName = (e && e.parameter && e.parameter.fileName) || "tournaments_registry.json";

    var folder = getStorageFolder(folderId);
    var files = folder.getFilesByName(fileName);

    if (files.hasNext()) {
      var file = files.next();
      var content = file.getBlob().getDataAsString();
      var base64 = Utilities.base64Encode(content);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileName: fileName,
        folderId: folder.getId(),
        fileContent: base64
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        folderId: folder.getId(),
        message: "File not found in folder: " + fileName
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
