import { readFileSync } from "fs";
import { assert } from "chai";
import { DIST_MAIN_JS } from "./helper";

const SOURCE_ALIAS_REQUIRE = /require\(['"](environment|logging|memory|profiling|shared|utils)\//g;

describe("built Screeps bundle", function () {
  it("does not leak source-path module requires into dist/main.js", function () {
    const bundle = readFileSync(DIST_MAIN_JS).toString();
    const unresolvedRequires = bundle.match(SOURCE_ALIAS_REQUIRE) ?? [];

    assert.deepEqual(unresolvedRequires, []);
  });
});
