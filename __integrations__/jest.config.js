module.exports = {
  preset: "ts-jest",
  collectCoverage: true,
  testEnvironment: "node",
  setupFilesAfterFramework: [],
  setupFiles: ["./jest.setup.js"],
  testPathIgnorePatterns: ["dist", "/node_modules"]
};
