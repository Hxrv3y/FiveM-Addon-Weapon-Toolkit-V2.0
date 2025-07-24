const fs = require('fs-extra');
const path = require('path');
const { scanWeaponTemplatesLogic } = require('./main');

describe('scanWeaponTemplatesLogic', () => {
  const mockAppBasePath = '/mock/app';

  beforeEach(() => {
    fs.readdir.mockReset();
  });

  test('should return an empty array if no template directories exist', async () => {
    fs.readdir.mockResolvedValue([]);

    const result = await scanWeaponTemplatesLogic(mockAppBasePath);

    expect(result.success).toBe(true);
    expect(result.templates).toEqual([]);
    expect(fs.readdir).toHaveBeenCalledWith(path.join(mockAppBasePath, 'templates', 'weapons'), { withFileTypes: true });
  });

  test('should return a list of template objects for each directory found', async () => {
    const mockDirents = [
      { name: 'WEAPON_RIFLE', isDirectory: () => true },
      { name: 'WEAPON_PISTOL', isDirectory: () => true },
      { name: 'somefile.txt', isDirectory: () => false },
    ];
    fs.readdir.mockResolvedValue(mockDirents);

    const result = await scanWeaponTemplatesLogic(mockAppBasePath);
    const expectedTemplatesDir = path.join(mockAppBasePath, 'templates', 'weapons');

    expect(result.success).toBe(true);
    expect(result.templates).toHaveLength(2);
    expect(result.templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'WEAPON_RIFLE', path: path.join(expectedTemplatesDir, 'WEAPON_RIFLE') }),
        expect.objectContaining({ name: 'WEAPON_PISTOL', path: path.join(expectedTemplatesDir, 'WEAPON_PISTOL') }),
      ])
    );
    expect(fs.readdir).toHaveBeenCalledWith(expectedTemplatesDir, { withFileTypes: true });
  });

  test('should handle errors during directory scanning', async () => {
    const errorMessage = 'Failed to read directory';
    fs.readdir.mockRejectedValue(new Error(errorMessage));

    const result = await scanWeaponTemplatesLogic(mockAppBasePath);
    const expectedTemplatesDir = path.join(mockAppBasePath, 'templates', 'weapons');

    expect(result.success).toBe(false);
    expect(result.error).toBe(errorMessage);
    expect(result.templates).toEqual([]);
    expect(fs.readdir).toHaveBeenCalledWith(expectedTemplatesDir, { withFileTypes: true });
  });
});
