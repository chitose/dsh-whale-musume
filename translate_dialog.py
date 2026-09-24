import csv
import re
from pathlib import Path

source = Path(r"C:\Users\pnh\Downloads\whale-moe-dialog.csv")
target = Path("whale-moe-dialog-ja-retranslated.csv")

emoji = re.compile(r"[\U0001F000-\U0001FAFF\u2600-\u27BF](?:\uFE0F|\u200D[\U0001F000-\U0001FAFF\u2600-\u27BF])*")

# Editorial corrections to the supplied draft translation, keyed by stable row ID.
corrections = {
    "idle:3": "疲れたら私をつついてね。ストレス解消は無料、裏なんてないよ。ほんとだってば",
    "waiting:0": "ご注文？うみかは準備万端だよ～",
    "waiting:1": "何を待ってるの？ひと言くれたら、すぐ開店するよ",
    "waiting:2": "新しい注文はまだないし、フライパンを拭いておこう……じゃなくて、機材を拭いておこう",
    "waiting:3": "順番待ち中。うみかのしっぽもスタンバイしてるよ",
    "thinking:0": "生クリームを泡立てて……じゃなかった、一生懸命考えてるよ～",
    "thinking:1": "うみかに考えさせてね……しっぽも一緒にくるくる回ってるよ",
    "thinking:2": "考え中だから、食べ物はあげないでね。頭に効くカップケーキなら別だけど",
    "thinking:3": "この問題、なかなか手ごわいね。今、うまくまとめてるところ",
    "thinking:4": "ひらめきを読み込み中。99％で止まるのは正常だよ",
    "tool:0": "キッチン開店！この注文はうみかに任せて～",
    "tool:2": "作業中！うみかがノートパソコンをぎゅっと抱えてるから、見物人は解散してね",
    "tool:3": "この速さについてこられる？無理ならお茶でも飲んで、ゆっくり待ってて",
    "success:2": "仕上げに入るよ！期間限定の褒め言葉、早い者勝ちだよ",
}

with source.open(encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    fields = reader.fieldnames
    rows = list(reader)

for row in rows:
    if row["id"] in corrections:
        row["japanese"] = corrections[row["id"]]
    marks = "".join(emoji.findall(row["english"]))
    row["japanese"] = emoji.sub("", row["japanese"]).rstrip() + marks

with target.open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} rows to {target.resolve()}")
