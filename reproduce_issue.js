
function n8r(t = "") {
    let r = String(t || "").trim();
    for (r = r.replace(/^[\[({<]+/, ""); /[)>.,;:!]+$/.test(r);)
        r = r.slice(0, -1);
    return r;
}
function k0(t = "") {
    let r = n8r(t);
    return r
        ? /^(?:https?|mailto|tel):/i.test(r)
            ? r
            : r.startsWith("//")
                ? `https:${r}`
                : r.startsWith("/")
                    ? `https://www.credly.com${r}`
                    : /^www\./i.test(r)
                        ? `https://${r}`
                        : /^(?:[a-z0-9.-]*\.)?linkedin\.com/i.test(r)
                            ? `https://${r}`
                            : /^(?:[a-z0-9.-]*\.)?credly\.com/i.test(r)
                                ? `https://${r}`
                                : r
        : "";
}

const badUrl = "https://www.linkedin.com/in/pushkar-mishraa/  Github : https://github.com/p2k3m";
const expected = "https://www.linkedin.com/in/pushkar-mishraa/";

console.log("Input:", badUrl);
const actual = k0(badUrl);
console.log("Output:", actual);

if (actual !== expected) {
    console.error("FAIL: output does not match expected");
    process.exit(1);
} else {
    console.log("PASS: output matches expected");
}
