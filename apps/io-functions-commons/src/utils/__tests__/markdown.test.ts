import { markdownToHtml } from "../markdown";

describe("markdownToHtml", () => {
  it("should convert markdown to HTML", async () => {
    const result = await markdownToHtml.process(`
# Hello world

How are you?
  `);

    expect(result.toString().replace(/[ \n]/g, "")).toBe(
      "<h1>Helloworld</h1><p>Howareyou?</p>",
    );
  });

  it("should remove the frontmatter", async () =>
    Promise.all(
      [
        `---
---
test
`,
        `---
some: var
---
test
`,
        `---
nasty: "---"
---
test
`,
        `
---

with extra lines

---

test
`,
      ].map(async (md) => {
        const result = await markdownToHtml.process(md);
        expect(result.toString().replace(/[ \n]/g, "")).toBe("<p>test</p>");
      }),
    ));
});
