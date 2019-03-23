module.exports = function makeSpinner ({duration, color, strokeWidth, radius}) {
  const svgNS = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttributeNS(svgNS, 'version', '1.1')
  svg.setAttributeNS(svgNS, 'baseProfile', 'full')
  const side = 2*radius + 2*strokeWidth
  svg.style.width = side
  svg.style.height = side
  svg.setAttributeNS(svgNS, 'viewBox', `-${radius} -${radius} ${radius} ${radius}`)
  svg.setAttribute('xmlns', svgNS)

  const spinner = document.createElementNS(svgNS, 'circle')
  spinner.setAttributeNS(null, 'cx', -(radius + strokeWidth))
  spinner.setAttributeNS(null, 'cy', radius + strokeWidth)
  spinner.setAttributeNS(null, 'r', radius)
  spinner.setAttributeNS(null, "fill", "transparent");
  spinner.setAttributeNS(null, "stroke", color);
  spinner.setAttributeNS(null, "stroke-width", strokeWidth+'px');

  const length = 2 * Math.PI * radius
  spinner.setAttributeNS(null, "stroke-dasharray", length);

  svg.appendChild(spinner)

  svg.setProgress = function (progress) {
    //so the stroke starts at the top of the circle
    spinner.style.transform = 'rotate(270deg)'
    spinner.setAttributeNS(null, "stroke-dasharray", `${length * progress} ${length * (1-progress)}`);
  }

  return svg
}
