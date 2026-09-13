// Decorative illustrations, not an application screenshot or an editable chart.
const motif = ['00011000','00111100','01100110','11000011','11000011','01100110','00111100','00011000'];
for (const target of document.querySelectorAll('.mini-chart, .stitches')) {
  for (const cell of motif.join('')) {
    const stitch = document.createElement('i');
    if (cell === '1') stitch.className = 'filled';
    target.append(stitch);
  }
}
