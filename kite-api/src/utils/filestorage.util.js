const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const config = require('../../config/config');

//const isDir = async filepath => (await fsp.stat(filepath)).isDirectory();

const getFileInfo = async (userDir, file) => {
  if(!file.startsWith(userDir)) {
    throw new Error('Access denied');
  }
  try {
    const fileStats = await fsp.stat(file)
    return {
      name: path.basename(file),
      created: fileStats.birthtime,
      isdirectory: fileStats.isDirectory(),
      modified: fileStats.mtime,
      size: fileStats.size
    }
  } catch(e) {
    if (e.code == 'ENOENT') {
      throw new Error('File not found');
    } else {
      throw e;
    }
  }
}

const getFileInfoHandler = async (userid, filepath) => getFileInfo(path.join(config.userFolderPath, userid), path.join(config.userFolderPath, userid, filepath));

const renameFile = async (userid, filepath, newFilePath) => {
  const oldFile = path.join(config.userFolderPath, userid, filepath);
  const newFile = path.join(config.userFolderPath, userid, newFilePath);
  const userDir = path.join(config.userFolderPath, userid);
  if(!oldFile.startsWith(userDir)) {
    //res.status(403).json({error: 'Access denied'});
    throw new Error('Access denied');
  }
  if(!newFile.startsWith(userDir)) {
    //res.status(403).json({error: 'Access denied'});
    throw new Error('Access denied');
  }
  try {
    await fsp.rename(oldFile, newFile);
    return getFileInfo(path.join(config.userFolderPath, userid), newFile);
  } catch(e) {
    if (e.code == 'ENOENT') {
      throw new Error('File not found');
      //res.status(404).json({error:'File not found'})
    } else {
      throw e;
    }
  }
}

const getDirContents = async (userid, filepath) => {
  const file = path.join(config.userFolderPath, userid, filepath);
  const userDir = path.join(config.userFolderPath, userid);
  if(!file.startsWith(userDir)) {
    //res.status(403).json({error: 'Access denied'});
    throw new Error('Access denied');
  }
  try {
    try {
      const files = await fsp.readdir(file)
      return {
          files: (await Promise.all(files.map(async filename => {
          const filepath = path.join(file, filename);
          const fileStats =  await fsp.stat(filepath);
          return {
            name: filename,
            created: fileStats.birthtime,
            isdirectory: fileStats.isDirectory(),
            modified: fileStats.mtime,
            size: fileStats.size
          }
        }))).sort((a, b) => {
          if(a.isdirectory === b.isdirectory) {
            return a.name > b.name ? -1 : 1; // Sort descending by name
          }
          return a.isdirectory ? -1 : 1; // Directories go first
        })
      }
    } catch(e) {
      throw new Error('File is not a directory');
    }
  } catch(e) {
    if (e.code == 'ENOENT') {
      throw new Error('File not found');
      //res.status(404).json({error:'File not found'})
    } else {
      throw e;
    }
  }
}

const getFileSizeInBytes = async userPath => {
  let absPath = path.join(config.userFolderPath, userPath);
  try {
    const stats = await fsp.stat(absPath);
    return stats['size'];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return `No file could be found at path: ${absPath}`;
    } else {
      return `${err}`;
    }
  }
};

const getDirSizeInBytes = async (dirPath, memo) => {
  const fileStats = await fsp.stat(dirPath);
  if(fileStats.isDirectory()) {
    const files = await fsp.readdir(dirPath);
    for (let file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fsp.stat(filePath);
      if(stats.isDirectory()) {
        await getDirSizeInBytes(filePath, memo);
      } else {
        memo[0] += stats['size'];
      }
    }
  } else {
    memo[0] = `The provided path is not a directory - `;
  }
  return memo;
}

const getDirSizeInBytesHandler = async (userPath) => {
  const memo = [0];
  const dirPath = path.join(config.userFolderPath, userPath); 
  const size = await getDirSizeInBytes(dirPath, memo);
  return size;
}

const storeFS = (userid, { stream, filename }) => {
  const UPLOAD_DIR = path.join(config.userFolderPath, userid);
  const fullpath = `${UPLOAD_DIR}/${filename}`
  return new Promise((resolve, reject) =>
    stream
      .on('error', error => {
        if (stream.truncated)
          // Delete the truncated file.
          fs.unlinkSync(fullpath)
        reject(error)
      })
      .pipe(fs.createWriteStream(fullpath))
      .on('error', error => reject(error))
      .on('finish', () => resolve({ fullpath }))
  )
}

const processUpload = async (userid, upload) => {
  const { createReadStream, filename } = await upload
  const stream = createReadStream()
  const { fullpath } = await storeFS(userid, { stream, filename })
  const userPath = path.join(config.userFolderPath, userid);
  console.log(userPath, fullpath)
  return getFileInfo(userPath, fullpath)
}


module.exports = { 
  getFileInfo,
  getFileInfoHandler,
  getDirContents, 
  getFileSizeInBytes, 
  getDirSizeInBytesHandler, 
  processUpload,
  renameFile
};