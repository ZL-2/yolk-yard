export function migrateReleaseBranding(history){
 const old=/\beggs?\b|yolk|shell|hatch|waddle|cartoon|albumen/i;
 return {...history,releases:history.releases.map(r=>old.test(JSON.stringify(r))?{number:r.number,title:'Archived quality update',changes:['Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier.']}:r)};
}
// Published releases, not CI attempts, are the source of the next number.
export function nextReleaseHistory(build, notes, previous) {
  if (!previous) return { schema: 1, build, releases: notes };
  if (previous.schema !== 1 || !Array.isArray(previous.releases) || !previous.releases.length)
    throw new Error("Invalid published release history");
  previous.releases.forEach((r, i, list) => {
    if (Number(r.number) !== list.length - i) throw new Error("Release numbers must be consecutive");
  });
  if (previous.build === build) return previous;
  const latest = notes[0];
  const alreadyPublished = previous.releases.some(r => r.title === latest.title && JSON.stringify(r.changes) === JSON.stringify(latest.changes));
  const entry = alreadyPublished
    ? { title: "Game improvements", changes: ["The latest game fixes and improvements."] }
    : { title: latest.title, changes: latest.changes };
  return { schema: 1, build, releases: [{ ...entry, number: String(previous.releases.length + 1).padStart(2, "0") }, ...previous.releases] };
}
