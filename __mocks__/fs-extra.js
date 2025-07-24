// __mocks__/fs-extra.js

// A simpler manual mock without jest.createMockFromModule

const fsExtraMock = {
  readdir: jest.fn(),
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  ensureFile: jest.fn(),
  copy: jest.fn(),
  // Add any other fs-extra functions your application code might call
};

module.exports = fsExtraMock;
