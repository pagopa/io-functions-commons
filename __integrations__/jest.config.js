module.exports = {
  preset: "ts-jest",
  collectCoverage: true,
  testEnvironment: "node",
  testTimeout: 10000,
  setupFiles: ["./jest.setup.js"],
  testPathIgnorePatterns: ["dist", "/node_modules"]
};
