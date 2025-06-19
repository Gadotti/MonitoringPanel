function csvToJson(csv) {
  const lines = csv.trim().split('\n');
  //const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v =>
      v.replace(/^"|"$/g, '').trim()
    );

    return headers.reduce((obj, header, idx) => {
      obj[header] = values[idx] || '';
      return obj;
    }, {});
  });
}

function parseCSVLine(line) {
  const regex = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\")|([^,]+)/g;
  const result = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
    result.push(match[1] ? match[1].replace(/""/g, '"') : match[2]);
  }
  return result;
}