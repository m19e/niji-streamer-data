import ky from "ky";
import { DOMParser, Element, HTMLDocument, Node } from "dom";

import { getHtmlUtf8 } from "/utils/tools.ts";

const SHIORIHA_URL =
  "https://wikiwiki.jp/nijisanji/%E6%A0%9E%E8%91%89%E3%82%8B%E3%82%8A";

enum StreamerURL {
  SHIORIHA = SHIORIHA_URL,
}

const STREAMER_SET = [
  {
    id: "shioriha_ruri",
    name: "栞葉るり",
    url: StreamerURL.SHIORIHA,
  },
] as const;

function isElement(n: Node): n is Element {
  return n instanceof Element;
}

function parseList(ul: Element): any[] {
  const result: any[] = [];
  // 直下のliのみを取得
  for (const li of Array.from(ul.querySelectorAll(":scope > li"))) {
    if (isElement(li)) {
      // liの子ulを取得（最初のみ想定、複数ulある場合はforEach等応用）
      const childUl = li.querySelector(":scope > ul");

      // li直下テキストを抽出
      const list = Array.from(li.childNodes)
        .filter((n) => n.nodeType === 3 || n.nodeType === 1) // TEXT_NODE, ELEMENT_NODE
        .filter((n) => !isElement(n) || n.tagName !== "UL") // ul除外
        .map((n) => n.textContent?.trim());

      const title = childUl ? list[0] : list.join("");

      if (childUl) {
        result.push({
          title,
          list: parseList(childUl),
        });
      } else {
        result.push({ title });
      }
    }
  }
  return result;
}

// TODO rename correctly
const REGEXP = /^#/;

type LinkNode = {
  title: string;
  href: string;
  children?: LinkNode[];
};

const extractAllHrefTrails = (ul: Element): LinkNode[] => {
  const trails: LinkNode[] = [];

  for (const li of Array.from(ul.querySelectorAll(":scope > li"))) {
    // Type Guard (convert Node to Element)
    if (!isElement(li)) continue;

    const a = li.querySelector(":scope > a");
    const title = a?.textContent.trim() ?? "";
    const href = (a?.getAttribute("href") ?? "").replace(REGEXP, "");

    const nestedUl = li.querySelector(":scope > ul");
    if (nestedUl) {
      trails.push({
        title,
        href,
        children: extractAllHrefTrails(nestedUl),
      });
    } else {
      trails.push({ title, href });
    }
  }
  return trails;
};

const getUlFromTitleH3 = (h3: Element): [string, Element] => {
  let h4 = h3.nextElementSibling;
  while (h4 && h4.tagName !== "H4") {
    h4 = h4.nextElementSibling;
  }
  const title = h4?.textContent.trim() ?? "";

  let ul = h3.nextElementSibling;
  while (ul && ul.tagName !== "UL") {
    ul = ul.nextElementSibling;
  }

  return [title, ul as Element];
};

const countLiver = (list: string[]) => {
  return list.reduce<Record<string, number>>((acc, liver) => {
    acc[liver] = (acc[liver] || 0) + 1;
    return acc;
  }, {});
};

const getTreeFromHref = (dom: HTMLDocument, href: string) => {
  const parentH3 = dom.querySelector(`a[name='${href}']`)
    ?.parentElement;
  const [treeTitle, ul] = getUlFromTitleH3(parentH3!);
  const tree = parseList(ul);

  const images = Array.from(ul.querySelectorAll("img"));
  const livers = images.filter(isElement).map((i) =>
    i.getAttribute("title") ?? ""
  );
  const count = countLiver(livers);

  return {
    treeTitle,
    tree,
    count,
  };
};

// TODO indexからツリー構造を取得
// TODO 項目ひとつ取得できるかデモ(#how_to_ruri)
// TODO 取得段階でhrefから文頭の'#'を除去(name属性と一致させるため)
export const getShiorihaDemo = async () => {
  const res = await ky(StreamerURL.SHIORIHA);
  const html = await getHtmlUtf8(res);
  const dom = new DOMParser().parseFromString(html, "text/html");
  if (!dom) {
    throw new Error("DOM parse failed");
  }

  const details = dom.querySelector(
    "#contents-index + ul > li > a[href='#details'] + ul",
  );
  const trails = extractAllHrefTrails(details!);
  const { title: rootTitle, href } = trails[0];

  // DEMO
  const { tree, treeTitle, count } = getTreeFromHref(dom, href);

  console.log(`詳しく知りたい > ${rootTitle} > ${treeTitle}`);
  console.log("count:", JSON.stringify(count, null, 2));
  console.log("tree:", JSON.stringify(tree, null, 2));

  return "getStreamer";
};
