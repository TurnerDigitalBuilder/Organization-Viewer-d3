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
  
    // Tooltip for node details
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");
  
    // Debounce function to limit rapid updates
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
  
    // Initialize SVG, zoom behavior, and tree layout
    function initializeSvg() {
      // Remove any existing SVG
      d3.select("#treeContainer").select("svg").remove();
  
      svg = d3.select("#treeContainer")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .call(d3.zoom().scaleExtent([0.2, 2]).on("zoom", (event) => {
          g.attr("transform", event.transform);
        }))
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
  
      g = svg.append("g");
  
      treemap = d3.tree().size([height, width]);
    }
  
    // Return appropriate color based on selected toggle
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
  
    // Extract all unique departments from the hierarchy
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
  
    // Update function for rendering nodes and links
    function update(source) {
      const treeData = treemap(root);
      const nodes = treeData.descendants(),
            links = treeData.descendants().slice(1);
  
      // Adjust node positions based on slider values
      nodes.forEach(d => {
        d.y = d.depth * sliderHorizontal;
        d.x = d.x * sliderVertical;
      });
  
      // --- Nodes section ---
      const node = g.selectAll("g.node")
        .data(nodes, d => d.id || (d.id = ++i));
  
      // Enter new nodes at the source's previous position
      const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${source.y0},${source.x0})`)
        .on("click", click)
        .on("mouseover", function(event, d) {
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`<strong>${d.data.name}</strong><br>${d.data.title || ""}`)
                   .style("left", (event.pageX + 5) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 5) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.transition().duration(500).style("opacity", 0);
        });
  
      // Append circles to nodes
      nodeEnter.append("circle")
        .attr("r", 1e-6)
        .attr("fill", d => getColor(d.data));
  
// Append indicator (plus/minus) for expand/collapse inside the circle
nodeEnter.append("text")
  .attr("class", "indicator")
  .attr("dy", ".35em")
  .attr("text-anchor", "middle")
  .attr("y", 0)  // Center vertically inside the circle
  .text(d => d.children ? "–" : d._children ? "+" : "");

  
      // Append node name
      nodeEnter.append("text")
        .attr("class", "name")
        .attr("dy", "-0.2em")
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
        .attr("transform", d => `translate(${d.y},${d.x})`);
  
      nodeUpdate.select("circle")
        .attr("r", 10)
        .attr("fill", d => getColor(d.data));
  
      nodeUpdate.select("text.indicator")
        .text(d => d.children ? "–" : d._children ? "+" : "");
  
      // Transition exiting nodes
      const nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .remove();
  
      nodeExit.select("circle")
        .attr("r", 1e-6);
  
      nodeExit.select("text")
        .style("fill-opacity", 1e-6);
  
      // --- Links section ---
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
        .attr("d", d => diagonal(d, d.parent));
  
      const linkExit = link.exit().transition()
        .duration(duration)
        .attr("d", d => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();
  
      // Save old positions for transitions
      nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }
  
    // Toggle children on node click
    function click(event, d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }
  
    // Handle JSON file input and create the tree
    document.getElementById("fileInput").addEventListener("change", function(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          let jsonData = JSON.parse(e.target.result);
          // Wrap array data in a virtual root if necessary
          if (Array.isArray(jsonData)) {
            jsonData = { name: "Root", children: jsonData };
          }
          // Clear previous error messages
          document.getElementById("errorMessage").textContent = "";
          // Initialize SVG and build hierarchy
          initializeSvg();
          root = d3.hierarchy(jsonData, d => d.children);
          root.x0 = height / 2;
          root.y0 = 0;
  
          // Update department color scale based on unique values
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
  
    // Debounced event handlers for sliders
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
  
    // Update color toggle and refresh the tree
    document.getElementById("colorToggle").addEventListener("change", function(e) {
      colorToggle = e.target.value;
      if (root) update(root);
    });
  
    // Reset zoom/view button handler
    document.getElementById("resetButton").addEventListener("click", function() {
      d3.select("#treeContainer").select("svg").transition().duration(750).call(
        d3.zoom().transform, d3.zoomIdentity
      );
    });
  
    // Reinitialize tree on window resize
    window.addEventListener("resize", debounce(function() {
      setDimensions();
      if (root) {
        initializeSvg();
        update(root);
      }
    }, 200));
  })();
  