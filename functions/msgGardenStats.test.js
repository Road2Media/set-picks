const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const {
  showsFromPhishnet,
  refreshPublicMsgGardenStats,
} = require("./msgGardenStats");

describe("msg garden phish.net normalize", () => {
  it("drops side projects and canceled nights, and keeps debut footnotes", () => {
    const { shows, upcoming, lastShowOrdinal } = showsFromPhishnet(
      [
        {
          artist_name: "Phish",
          showdate: "2010-12-31",
          setlist_notes: "This was the 40th performance at Madison Square Garden.",
        },
        {
          artist_name: "Phish",
          showdate: "2021-12-31",
          setlist_notes: "This performance was canceled.",
        },
        { artist_name: "Trey Anastasio Band", showdate: "2005-12-31" },
        { artist_name: "Phish", showdate: "2027-01-02" },
      ],
      [
        {
          artist_name: "Phish",
          showdate: "2010-12-31",
          song: "Burn That Bridge",
          set: "1",
          position: 5,
          footnote: "Phish debut.",
          gap: 0,
        },
        {
          artist_name: "Phish",
          showdate: "2010-12-31",
          song: "Wilson",
          set: "1",
          position: 1,
          footnote: "",
          gap: 4,
        },
        {
          artist_name: "Trey Anastasio Band",
          showdate: "2005-12-31",
          song: "Night Speaks",
          set: "1",
          position: 1,
        },
        {
          artist_name: "Phish",
          showdate: "2021-12-31",
          song: "Ghost",
          set: "1",
          position: 1,
        },
      ],
      "2026-10-22",
    );

    assert.equal(shows.length, 2);
    const played = shows.find((show) => show.showDate === "2010-12-31");
    assert.equal(played.songs.length, 2);
    assert.equal(played.songs.find((song) => song.title === "Burn That Bridge").debut, true);
    assert.equal(upcoming.length, 1);
    assert.equal(upcoming[0].showDate, "2027-01-02");
    assert.equal(lastShowOrdinal, 40);
    const canceled = shows.find((show) => show.showDate === "2021-12-31");
    assert.equal(canceled.canceled, true);
  });
});

describe("refreshPublicMsgGardenStats", () => {
  it("refuses a short count and does not write", async () => {
    let writes = 0;
    const db = {
      collection() {
        return {
          doc() {
            return {
              async set() {
                writes += 1;
              },
            };
          },
        };
      },
    };
    const result = await refreshPublicMsgGardenStats(db, {
      today: "2026-10-22",
      minShowCount: 90,
      showRows: [
        { artist_name: "Phish", showdate: "1994-12-30" },
      ],
      setlistRows: [
        {
          artist_name: "Phish",
          showdate: "1994-12-30",
          song: "Wilson",
          set: "1",
          position: 1,
          gap: 1,
        },
      ],
      logger: { warn() {}, error() {}, info() {} },
    });
    assert.equal(result.written, false);
    assert.equal(result.reason, "short-count");
    assert.equal(result.showCount, 1);
    assert.equal(writes, 0);
  });

  it("writes aggregates only when the count clears the floor", async () => {
    /** @type {object | null} */
    let payload = null;
    const db = {
      collection() {
        return {
          doc() {
            return {
              async set(next) {
                payload = next;
              },
            };
          },
        };
      },
    };
    const showRows = [];
    const setlistRows = [];
    for (let i = 0; i < 3; i += 1) {
      const showdate = `201${i}-12-31`;
      showRows.push({ artist_name: "Phish", showdate });
      setlistRows.push({
        artist_name: "Phish",
        showdate,
        song: "Tweezer",
        set: "1",
        position: 1,
        gap: 40,
        footnote: "",
      });
    }
    const result = await refreshPublicMsgGardenStats(db, {
      today: "2026-10-22",
      minShowCount: 3,
      showRows,
      setlistRows,
      logger: { warn() {}, error() {}, info() {} },
    });
    assert.equal(result.written, true);
    assert.equal(result.showCount, 3);
    assert.equal(payload.topSongs[0].title, "Tweezer");
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.shows, undefined);
    assert.ok(!JSON.stringify(payload).includes("setlist"));
  });
});

describe("msg garden aggregator vendor", () => {
  it("matches the feature source file", () => {
    const src = readFileSync(
      path.join(
        __dirname,
        "../src/features/msg-stats/model/aggregateMsgGardenStats.js",
      ),
      "utf8",
    );
    const vendor = readFileSync(
      path.join(__dirname, "vendor/aggregateMsgGardenStats.mjs"),
      "utf8",
    );
    assert.equal(vendor, src);
  });
});
