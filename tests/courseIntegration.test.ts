import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultDB } from "../src/db";
import { articleDefaults, type Seed } from "../src/model";
import { initializeLibrary } from "../src/seed";
import { internalLinks, rewriteLinks } from "../src/links";
import { parseCourseBlock, assessmentState } from "../src/courseBlocks";
import { exportArchive, importArchive, inspectArchive } from "../src/archive";
import catalog from "../content/textbooks/catalog.json";

const databases: VaultDB[] = [];
function database() { const db = new VaultDB(`course-test-${crypto.randomUUID()}`); databases.push(db); return db; }
const block = (language: string, value: unknown) => `~~~~${language}\n${JSON.stringify(value)}\n~~~~\n`;
afterEach(async () => { vi.unstubAllGlobals(); for (const db of databases.splice(0)) await db.delete(); });

describe("reviewed course integration", () => {
  it("finds and remaps links in nested disclosures and merged tables, leaving code alone", () => {
    const body = block("zhizhan-details", { title:"答案", body:
      "[下一章](doc:chapter#step)\n\n```c\n// doc:chapter is example text\n```\n" +
      block("zhizhan-table", { rows:[[{body:"[数据](asset:data)",header:false,rowSpan:2,colSpan:1}]] }) });
    expect(internalLinks(body)).toEqual([{kind:"doc",id:"chapter"},{kind:"asset",id:"data"}]);
    const updated = rewriteLinks(body, url => url.replace("doc:chapter", "doc:new-chapter").replace("asset:data", "asset:new-data"));
    expect(internalLinks(updated)).toEqual([{kind:"doc",id:"new-chapter"},{kind:"asset",id:"new-data"}]);
    expect(updated).toContain("// doc:chapter is example text");
  });

  it("upgrades an initialized 1.14 library once without resurrecting old courses or changing personal notes", async () => {
    const db=database();
    await db.articles.bulkAdd([
      {...articleDefaults("book-b00","旧教程"),id:"book-b00-01",note:"旧版笔记"},
      {...articleDefaults("personal","我的项目"),id:"private-project",note:"个人记录",progress:80},
    ]);
    await db.settings.bulkPut([{key:"initialized",value:true},{key:"builtinContent",value:{version:"2026.10.13.1",articles:{}}}]);
    const incoming:Seed={contentVersion:catalog.installationVersion,attachments:[],
      shelves:[{id:"course-b00",title:"C 基础",kind:"course",description:"",color:"#456d75",createdAt:1}],
      articles:[{...articleDefaults("course-b00","新版第一课"),id:"course-b00-m01",body:"有具体验收的新课"}]};
    const fetcher=vi.fn(async()=>new Response(JSON.stringify(incoming)));
    vi.stubGlobal("fetch",fetcher);
    await initializeLibrary(db);
    expect(await db.articles.get("course-b00-m01")).toMatchObject({deletedAt:0,body:"有具体验收的新课"});
    expect((await db.articles.get("book-b00-01"))?.deletedAt).toBeGreaterThan(0);
    expect((await db.articles.get("book-b00-01"))?.note).toBe("旧版笔记");
    expect(await db.articles.get("private-project")).toMatchObject({note:"个人记录",progress:80,deletedAt:0});
    await initializeLibrary(db);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await db.articles.count()).toBe(3);
  });

  it("backs up self-assessments and invalidates checks when the acceptance criterion changes", async () => {
    const from=database(), to=database();
    const key="course-assessment:course-b06-m01",value={criterion:"响应时间不超期限",checks:["explain","run"]};
    await from.settings.bulkPut([{key,value},{key:"course-assessment:course-bad",value:{criterion:"坏记录",checks:["invented"]}}]);
    const inspected=await inspectArchive(await exportArchive(from));
    expect(inspected.manifest.settings).toEqual([{key,value}]);
    await importArchive(inspected,to);
    expect(assessmentState((await to.settings.get(key))?.value,value.criterion)).toEqual(["explain","run"]);
    expect(assessmentState(value,"新增过载验收")).toEqual([]);
    expect(parseCourseBlock("zhizhan-table",JSON.stringify({rows:[[{body:"x",header:false,rowSpan:-1,colSpan:1}]]}))).toBeNull();
  });
});
