(function() {
  // Define margins and initial dimensions
  const margin = { top: 20, right: 90, bottom: 30, left: 90 };
  let width, height;
  const container = document.getElementById("treeContainer");

  let svg, g, root, treemap, i = 0, duration = 750;
  let sliderHorizontal = +document.getElementById("spacingSlider").value;
  let sliderVertical = +document.getElementById("verticalSlider").value;
  let colorToggle = document.getElementById("colorToggle").value;

  // Global color scales
  let departmentColors;
  const emailColors = d3.scaleOrdinal(d3.schemeCategory10);

  // Debounce helper
  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Set SVG dimensions based on container size
  function setDimensions() {
    width = container.clientWidth - margin.left - margin.right;
    height = container.clientHeight - margin.top - margin.bottom;
  }
  setDimensions();

  // Initialize SVG with zoom behavior and tree layout
  function initializeSvg() {
    d3.select("#treeContainer").select("svg").remove();
    svg = d3.select("#treeContainer")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .call(d3.zoom().scaleExtent([0.2, 2]).on("zoom", (event) => {
        g.attr("transform", event.transform);
        updateMinimapViewport(event.transform);
      }))
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g = svg.append("g");
    treemap = d3.tree().size([height, width]);
  }

  // Update legend based on current color toggle
  function updateLegend() {
    const legend = document.getElementById("legend");
    let html = "";
    if (colorToggle === "department" && root) {
      const depts = departmentColors.domain();
      html += "<strong>Departments:</strong><br>";
      depts.forEach(d => {
        const color = departmentColors(d);
        html += `<span style="color:${color}">&#9632;</span> ${d}<br>`;
      });
    } else if (colorToggle === "email") {
      html += "<strong>Email Domains:</strong><br>";
      emailColors.domain(["example.com", "sample.org", "test.net"]);
      ["example.com", "sample.org", "test.net"].forEach(d => {
        const color = emailColors(d);
        html += `<span style="color:${color}">&#9632;</span> ${d}<br>`;
      });
    } else if (colorToggle === "chatgptLicense") {
      html += `<span style="color:red">&#9632;</span> Licensed (red), default (white)`;
    }
    legend.innerHTML = html;
  }

  // Return appropriate color based on data and toggle
  function getColor(data) {
    if (colorToggle === "department") {
      return data.department ? departmentColors(data.department) : "#fff";
    } else if (colorToggle === "email") {
      const domain = data.email ? data.email.split("@")[1].toLowerCase() : "";
      return domain ? emailColors(domain) : "#fff";
    } else if (colorToggle === "chatgptLicense") {
      return data.chatgptLicense === "true" ? "red" : "#fff";
    }
    return "#fff";
  }

  // Extract unique departments from the hierarchy
  function getUniqueDepartments(rootNode) {
    const deptSet = new Set();
    rootNode.each(d => {
      if (d.data.department) {
        deptSet.add(d.data.department);
      }
    });
    return Array.from(deptSet);
  }

  // Diagonal path generator for links
  function diagonal(s, d) {
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
  }

  // Update the details panel with node information
  function updateDetails(d) {
    const details = document.getElementById("detailsContent");
    let html = `<strong>Name:</strong> ${d.data.name}<br>`;
    if (d.data.title) html += `<strong>Title:</strong> ${d.data.title}<br>`;
    if (d.data.department) html += `<strong>Department:</strong> ${d.data.department}<br>`;
    if (d.data.email) html += `<strong>Email:</strong> ${d.data.email}<br>`;
    if (d.data.chatgptLicense) html += `<strong>ChatGPT License:</strong> ${d.data.chatgptLicense}<br>`;
    details.innerHTML = html;
  }

  // Update function for rendering nodes and links; dummy root (depth 0) is filtered out
  function update(source) {
    const treeData = treemap(root);
    const allNodes = treeData.descendants();
    // Filter out dummy root node (depth 0)
    const nodes = allNodes.filter(d => d.depth > 0);
    // Only show links where parent's depth > 0 (i.e. not from the dummy root)
    const links = treeData.descendants().filter(d => d.depth > 1);

    // Recalculate positions using effective depth (subtract 1)
    nodes.forEach(d => {
      d.effectiveDepth = d.depth - 1;
      d.y = (d.depth - 1) * sliderHorizontal;
      d.x = d.x * sliderVertical;
    });

    // --- Nodes Section ---
    const node = g.selectAll("g.node")
      .data(nodes, d => d.id || (d.id = ++i));

    // Enter new nodes
    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("role", "treeitem")
      .attr("tabindex", 0)
      .attr("aria-expanded", d => d.children ? "true" : "false")
      .attr("transform", d => `translate(${source.y0},${source.x0})`)
      .on("click", function(event, d) {
          updateDetails(d);
          click(event, d);
      })
      .on("keydown", function(event, d) {
          if (event.key === "Enter" || event.key === " ") {
            updateDetails(d);
            click(event, d);
          } else if (event.key === "ArrowRight" && d._children) {
            click(event, d);
          } else if (event.key === "ArrowLeft" && d.children) {
            click(event, d);
          }
      });

    // Append circle for each node
    nodeEnter.append("circle")
      .attr("r", 1e-6)
      .attr("fill", d => getColor(d.data));

    // Append indicator (plus/minus) inside the circle
    nodeEnter.append("text")
      .attr("class", "indicator")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("y", 0)
      .text(d => d.children ? "–" : d._children ? "+" : "");

    // Append node name text
    nodeEnter.append("text")
      .attr("class", "name")
      .attr("dy", "-0.8em")
      .attr("x", d => (d.children || d._children) ? -13 : 13)
      .attr("text-anchor", d => (d.children || d._children) ? "end" : "start")
      .text(d => d.data.name);

    // Append title text if available
    nodeEnter.append("text")
      .attr("class", "title")
      .attr("dy", "1em")
      .attr("x", d => (d.children || d._children) ? -13 : 13)
      .attr("text-anchor", d => (d.children || d._children) ? "end" : "start")
      .text(d => d.data.title ? d.data.title : "");

    // Merge entering and existing nodes
    const nodeUpdate = nodeEnter.merge(node);

    nodeUpdate.transition()
      .duration(duration)
      .ease(d3.easeCubic)
      .attr("transform", d => `translate(${d.y},${d.x})`);

    nodeUpdate.select("circle")
      .attr("r", 10)
      .attr("fill", d => getColor(d.data));

    nodeUpdate.select("text.indicator")
      .text(d => d.children ? "–" : d._children ? "+" : "");

    // Exit nodes
    const nodeExit = node.exit().transition()
      .duration(duration)
      .ease(d3.easeCubic)
      .attr("transform", d => `translate(${source.y},${source.x})`)
      .remove();

    nodeExit.select("circle")
      .attr("r", 1e-6);

    nodeExit.select("text")
      .style("fill-opacity", 1e-6);

    // --- Links Section ---
    const link = g.selectAll("path.link")
      .data(links, d => d.id);

    const linkEnter = link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", d => {
        const o = { x: source.x0, y: source.y0 };
        return diagonal(o, o);
      });

    const linkUpdate = linkEnter.merge(link);

    linkUpdate.transition()
      .duration(duration)
      .ease(d3.easeCubic)
      .attr("d", d => diagonal(d, d.parent));

    const linkExit = link.exit().transition()
      .duration(duration)
      .ease(d3.easeCubic)
      .attr("d", d => {
        const o = { x: source.x, y: source.y };
        return diagonal(o, o);
      })
      .remove();

    // Save the old positions for transition.
    allNodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });

    updateLegend();
    updateMinimap();
    highlightSearchResults();
  }

  // Toggle children on node click
  function click(event, d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
      d3.select(this).attr("aria-expanded", "false");
    } else {
      d.children = d._children;
      d._children = null;
      d3.select(this).attr("aria-expanded", "true");
    }
    update(d);
  }

  // Highlight nodes based on search query
  function highlightSearchResults() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    g.selectAll("g.node").select("circle")
      .attr("stroke", d => {
        if (query && d.data.name.toLowerCase().includes(query)) {
          return "orange";
        }
        return "#007bff";
      })
      .attr("stroke-width", d => {
        if (query && d.data.name.toLowerCase().includes(query)) {
          return 4;
        }
        return 2;
      });
  }

  // Export the current SVG as an SVG file
  function exportSVG() {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(d3.select("#treeContainer svg").node());
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tree.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Update the minimap by cloning and scaling down the tree group
  function updateMinimap() {
    const minimapContainer = d3.select("#minimap");
    minimapContainer.selectAll("*").remove();
    const scaleFactor = 0.2;
    const minimapSvg = minimapContainer.append("svg")
      .attr("width", 200)
      .attr("height", 150)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

    const clone = minimapSvg.append("g")
      .attr("transform", `scale(${scaleFactor}) translate(${margin.left},${margin.top})`);
    clone.node().appendChild(g.node().cloneNode(true));
    minimapSvg.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 200)
      .attr("height", 150)
      .attr("fill", "none")
      .attr("stroke", "red")
      .attr("stroke-width", 1);
  }

  // Dummy function for updating viewport rectangle in minimap (can be extended)
  function updateMinimapViewport(transform) {
    // Enhancement: draw/update a rectangle indicating the current zoom viewport.
  }

  // Handle JSON file input. If JSON is an array, wrap it in a dummy root with an empty name.
  document.getElementById("fileInput").addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        let jsonData = JSON.parse(e.target.result);
        if (Array.isArray(jsonData)) {
          jsonData = { name: "", children: jsonData };
        }
        document.getElementById("errorMessage").textContent = "";
        initializeSvg();
        root = d3.hierarchy(jsonData, d => d.children);
        root.x0 = height / 2;
        root.y0 = 0;
        const uniqueDepartments = getUniqueDepartments(root);
        departmentColors = d3.scaleOrdinal()
          .domain(uniqueDepartments)
          .range(d3.quantize(d3.interpolateRainbow, uniqueDepartments.length));
        update(root);
      } catch (error) {
        console.error("Error parsing JSON:", error);
        document.getElementById("errorMessage").textContent = "Invalid JSON file. Please select a valid JSON file.";
      }
    };
    reader.readAsText(file);
  });

  // Debounced slider handlers
  const debouncedHorizontal = debounce(function(e) {
    sliderHorizontal = +e.target.value;
    if (root) update(root);
  }, 100);
  const debouncedVertical = debounce(function(e) {
    sliderVertical = +e.target.value;
    if (root) update(root);
  }, 100);

  document.getElementById("spacingSlider").addEventListener("input", debouncedHorizontal);
  document.getElementById("verticalSlider").addEventListener("input", debouncedVertical);

  // Color toggle handler
  document.getElementById("colorToggle").addEventListener("change", function(e) {
    colorToggle = e.target.value;
    if (root) update(root);
  });

  // Search input handler
  document.getElementById("searchInput").addEventListener("input", debounce(highlightSearchResults, 100));

  // Export button
  document.getElementById("exportButton").addEventListener("click", exportSVG);

  // Reset zoom button
  document.getElementById("resetButton").addEventListener("click", function() {
    d3.select("#treeContainer").select("svg").transition().duration(750).call(
      d3.zoom().transform, d3.zoomIdentity
    );
  });

  // Toggle control panel visibility
  document.getElementById("toggleControls").addEventListener("click", function() {
    const content = document.getElementById("controlsContent");
    if (content.style.display === "none") {
      content.style.display = "block";
      this.textContent = "Hide Controls";
      this.setAttribute("aria-expanded", "true");
    } else {
      content.style.display = "none";
      this.textContent = "Show Controls";
      this.setAttribute("aria-expanded", "false");
    }
  });

  // Reinitialize on window resize
  window.addEventListener("resize", debounce(function() {
    setDimensions();
    if (root) {
      initializeSvg();
      update(root);
    }
  }, 200));
})();
