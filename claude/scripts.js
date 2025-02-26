// Enhanced scripts.js with improved functionality
(function() {
  // Define margins and initial dimensions
  const margin = { top: 20, right: 90, bottom: 30, left: 90 };
  let width, height;
  const container = document.getElementById("treeContainer");

  let svg, g, root, treemap, i = 0, duration = 750;
  let sliderHorizontal = +document.getElementById("spacingSlider").value;
  let sliderVertical = +document.getElementById("verticalSlider").value;
  let colorToggle = document.getElementById("colorToggle").value;
  let darkMode = false;
  let originalData = null;

  // Global color scales
  let departmentColors;
  const emailColors = d3.scaleOrdinal(d3.schemeCategory10);
  
  // Set up legend container
  const legend = d3.select("body").append("div").attr("class", "legend");

  // Tooltip for node details
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  // Loading indicator
  const loadingIndicator = d3.select("body").append("div")
      .attr("class", "loading-indicator")
      .style("display", "none")
      .html('<div class="spinner"></div><div>Loading data...</div>');

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
      .call(d3.zoom().scaleExtent([0.2, 5]).on("zoom", (event) => {
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
      return data.department ? departmentColors(data.department) : (darkMode ? "#333" : "#fff");
    } else if (colorToggle === "email") {
      const domain = data.email ? data.email.split("@")[1].toLowerCase() : "";
      return domain ? emailColors(domain) : (darkMode ? "#333" : "#fff");
    } else if (colorToggle === "chatgptLicense") {
      return data.chatgptLicense === "true" ? "#ff4444" : (darkMode ? "#333" : "#fff");
    } else if (colorToggle === "reports") {
      return data._directReports ? colorByReportCount(data._directReports) : (darkMode ? "#333" : "#fff");
    }
    return darkMode ? "#333" : "#fff";
  }

  // Color scale based on number of direct reports
  function colorByReportCount(count) {
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, 20]); // Adjust domain as needed
    return colorScale(Math.min(count, 20));
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

  // Extract all unique email domains from the hierarchy
  function getUniqueEmailDomains(rootNode) {
    const domainSet = new Set();
    rootNode.each(d => {
      if (d.data.email) {
        const domain = d.data.email.split("@")[1].toLowerCase();
        if (domain) domainSet.add(domain);
      }
    });
    return Array.from(domainSet);
  }

  // Create color legend
  function updateLegend() {
    legend.html("");
    legend.style("display", "block");
    
    if (colorToggle === "department") {
      const departments = getUniqueDepartments(root);
      legend.append("h3").text("Departments");
      departments.forEach(dept => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
          .attr("class", "legend-color")
          .style("background-color", departmentColors(dept));
        item.append("div")
          .attr("class", "legend-label")
          .text(dept);
      });
    } else if (colorToggle === "email") {
      const domains = getUniqueEmailDomains(root);
      legend.append("h3").text("Email Domains");
      domains.forEach(domain => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
          .attr("class", "legend-color")
          .style("background-color", emailColors(domain));
        item.append("div")
          .attr("class", "legend-label")
          .text(domain);
      });
    } else if (colorToggle === "chatgptLicense") {
      legend.append("h3").text("ChatGPT License");
      
      const itemYes = legend.append("div").attr("class", "legend-item");
      itemYes.append("div")
        .attr("class", "legend-color")
        .style("background-color", "#ff4444");
      itemYes.append("div")
        .attr("class", "legend-label")
        .text("Has License");
      
      const itemNo = legend.append("div").attr("class", "legend-item");
      itemNo.append("div")
        .attr("class", "legend-color")
        .style("background-color", darkMode ? "#333" : "#fff")
        .style("border", "1px solid #ccc");
      itemNo.append("div")
        .attr("class", "legend-label")
        .text("No License");
    } else if (colorToggle === "reports") {
      legend.append("h3").text("Direct Reports");
      
      const gradientContainer = legend.append("div")
        .attr("class", "gradient-legend");
      
      const gradientLabels = legend.append("div")
        .attr("class", "gradient-labels");
      
      gradientLabels.append("span").text("0");
      gradientLabels.append("span").text("10+");
    }
  }

  // Diagonal path generator for links
  function diagonal(s, d) {
    // Safety check for valid coordinates
    if (!s || !d || s.x === undefined || s.y === undefined || 
        d.x === undefined || d.y === undefined) {
      return ""; // Return empty path if coordinates are invalid
    }
    
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
  }

  // Calculate the count of direct reports for each node
  function calculateDirectReports(node) {
    if (!node.children && !node._children) {
      node.data._directReports = 0;
      return 0;
    }
    
    const childrenCount = (node.children ? node.children.length : 0) + 
                         (node._children ? node._children.length : 0);
    
    let totalReports = childrenCount;
    
    if (node.children) {
      node.children.forEach(child => {
        totalReports += calculateDirectReports(child);
      });
    }
    
    node.data._directReports = childrenCount;
    return totalReports;
  }

  // Search and highlight nodes that match the query
  function searchNodes(query) {
    if (!query) {
      // Reset all nodes to normal appearance
      d3.selectAll(".node circle").style("stroke", "steelblue").style("stroke-width", "3px");
      d3.selectAll(".node text").style("font-weight", "normal");
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    let found = false;
    
    d3.selectAll(".node").each(function(d) {
      const matches = 
        (d.data.name && d.data.name.toLowerCase().includes(lowerQuery)) || 
        (d.data.title && d.data.title.toLowerCase().includes(lowerQuery)) ||
        (d.data.email && d.data.email.toLowerCase().includes(lowerQuery)) ||
        (d.data.department && d.data.department.toLowerCase().includes(lowerQuery));
      
      d3.select(this).select("circle")
        .style("stroke", matches ? "#ff6600" : "steelblue")
        .style("stroke-width", matches ? "5px" : "3px");
      
      d3.select(this).selectAll("text")
        .style("font-weight", matches ? "bold" : "normal");
      
      if (matches) found = true;
    });
    
    return found;
  }

  // Filter tree data based on criteria
  function filterTree(criteria) {
    // Clone the original data to start fresh
    const filteredData = JSON.parse(JSON.stringify(originalData));
    
    // Function to recursively filter the tree
    function filterNode(node) {
      if (!node.children) return false;
      
      node.children = node.children.filter(child => {
        // First apply filter recursively to this child's children
        const hasMatchingChildren = child.children ? filterNode(child) : false;
        
        // Check if this node matches filter criteria
        const matchesCriteria = 
          !criteria.department || 
          (child.department && child.department.toLowerCase().includes(criteria.department.toLowerCase()));
        
        // Keep this node if it matches criteria or has children that match
        return matchesCriteria || hasMatchingChildren;
      });
      
      return node.children.length > 0;
    }
    
    // Apply filtering
    filterNode(filteredData);
    
    // Re-render the tree with filtered data
    renderTree(filteredData);
  }

  // Render tree with new data
  function renderTree(data) {
    initializeSvg();
    root = d3.hierarchy(data, d => d.children);
    root.x0 = height / 2;
    root.y0 = 0;
    
    // Calculate direct reports for each node
    calculateDirectReports(root);

    // Update color scales
    const uniqueDepartments = getUniqueDepartments(root);
    departmentColors = d3.scaleOrdinal()
      .domain(uniqueDepartments)
      .range(d3.quantize(d3.interpolateRainbow, Math.max(uniqueDepartments.length, 1)));
    
    // Initialize children/collapse state for all nodes
    root.descendants().forEach(d => {
      // Store any existing children in _children
      if (d.children) {
        d._children = d.children;
      }
    });
    
    // By default, only show the first level
    expandToLevel(root, 1);
    
    update(root);
    updateLegend();
  }

  // Update function for rendering nodes and links
  function update(source) {
    const treeData = treemap(root);
    let nodes = treeData.descendants();
    
    // Remove virtual root from visual representation if present
    const hasVirtualRoot = root.data._isVirtualRoot;
    if (hasVirtualRoot && root.children) {
      // Adjust positions for children of virtual root
      root.children.forEach(child => {
        child.x0 = root.x0;
        child.y0 = root.y0;
      });
    }
    
    // Filter out virtual root from visualization
    nodes = nodes.filter(d => !d.data._isVirtualRoot);
    
    // Get links (excluding any from virtual root)
    const links = nodes.filter(d => d.parent && !d.parent.data._isVirtualRoot).map(d => ({
      id: d.id,
      source: d.parent,
      target: d,
      x: d.x,
      y: d.y
    }));

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
      .on("contextmenu", function(event, d) {
        event.preventDefault();
        showContextMenu(event, d);
      })
      .on("mouseover", function(event, d) {
          tooltip.transition().duration(200).style("opacity", 0.9);
          
          // Create rich tooltip content
          let html = `<strong>${d.data.name || 'Unknown'}</strong>`;
          
          if (d.data.title) html += `<br>${d.data.title}`;
          if (d.data.department) html += `<br>Department: ${d.data.department}`;
          if (d.data.email) html += `<br>Email: ${d.data.email}`;
          if (d.data._directReports !== undefined) {
            html += `<br>Direct Reports: ${d.data._directReports}`;
          }
          if (d.data.chatgptLicense) {
            html += `<br>ChatGPT License: ${d.data.chatgptLicense === "true" ? "Yes" : "No"}`;
          }
          
          tooltip.html(html)
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
      })
      .style("display", d => {
        // Hide links from virtual root if present
        return root.data._isVirtualRoot && d.source === root ? "none" : null;
      });

    const linkUpdate = linkEnter.merge(link);

    linkUpdate.transition()
      .duration(duration)
      .attr("d", d => {
        // For the virtual root case, the links need special handling
        if (root.data._isVirtualRoot && d.source === root) {
          return ""; // Hide links from virtual root
        }
        return diagonal(d.source || d, d.target || d.parent);
      });

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

  // Context menu for additional node actions
  function showContextMenu(event, d) {
    // Remove any existing context menu
    d3.select(".context-menu").remove();
    
    // Create context menu
    const menu = d3.select("body")
      .append("div")
      .attr("class", "context-menu")
      .style("left", (event.pageX) + "px")
      .style("top", (event.pageY) + "px");
    
    // Focus on this node
    menu.append("div")
      .attr("class", "menu-item")
      .text("Focus on this node")
      .on("click", () => {
        // Calculate appropriate zoom level and position
        const transform = d3.zoomIdentity
          .translate(width / 2 - d.y, height / 2 - d.x)
          .scale(1.5);
        
        d3.select("#treeContainer").select("svg")
          .transition().duration(750)
          .call(d3.zoom().transform, transform);
        
        // Close menu
        d3.select(".context-menu").remove();
      });
    
    // Expand/collapse all children
    menu.append("div")
      .attr("class", "menu-item")
      .text(d.children ? "Collapse all children" : "Expand all children")
      .on("click", () => {
        // Function to recursively expand/collapse
        function toggleChildren(node, expand) {
          if (!node) return;
          
          if (expand) {
            if (node._children) {
              node.children = node._children;
              node._children = null;
              node.children.forEach(child => toggleChildren(child, expand));
            }
          } else {
            if (node.children) {
              node._children = node.children;
              node.children = null;
            }
          }
        }
        
        // Toggle expansion state
        toggleChildren(d, !d.children);
        update(d);
        
        // Close menu
        d3.select(".context-menu").remove();
      });
    
    // Show details in a sidebar
    menu.append("div")
      .attr("class", "menu-item")
      .text("Show detailed info")
      .on("click", () => {
        showDetailSidebar(d);
        d3.select(".context-menu").remove();
      });
    
    // Close on document click
    d3.select("body").on("click.contextmenu", function() {
      d3.select(".context-menu").remove();
      d3.select("body").on("click.contextmenu", null);
    });
  }

  // Show detailed information sidebar
  function showDetailSidebar(d) {
    // Remove existing sidebar if any
    d3.select(".detail-sidebar").remove();
    
    // Create sidebar
    const sidebar = d3.select("body")
      .append("div")
      .attr("class", "detail-sidebar");
    
    // Add close button
    sidebar.append("div")
      .attr("class", "close-button")
      .html("&times;")
      .on("click", () => {
        sidebar.transition().duration(300)
          .style("right", "-350px")
          .on("end", () => sidebar.remove());
      });
    
    // Add content header
    sidebar.append("h2").text(d.data.name || "Details");
    
    // Add info table
    const table = sidebar.append("table");
    
    // Helper to add a row
    function addRow(label, value) {
      if (value !== undefined && value !== null && value !== "") {
        const row = table.append("tr");
        row.append("td").attr("class", "label").text(label);
        row.append("td").attr("class", "value").text(value);
      }
    }
    
    // Add all available data
    for (const [key, value] of Object.entries(d.data)) {
      if (key === "children" || key === "_children" || key === "name") continue;
      addRow(key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'), value);
    }
    
    // Add hierarchy info
    addRow("Level", d.depth);
    addRow("Direct Reports", d.data._directReports || 0);
    
    // Add parent info if available
    if (d.parent) {
      sidebar.append("h3").text("Reports to");
      const parent = d.parent;
      addRow("Manager", parent.data.name);
      addRow("Title", parent.data.title);
    }
    
    // Slide in animation
    sidebar.style("right", "-350px")
      .transition().duration(300)
      .style("right", "0px");
  }

  // Export current view as SVG
  function exportSVG() {
    const svgEl = document.querySelector("#treeContainer svg");
    if (!svgEl) return;
    
    // Clone the SVG
    const svgClone = svgEl.cloneNode(true);
    
    // Add inline CSS
    const styleEl = document.createElement("style");
    Array.from(document.styleSheets)
      .filter(sheet => {
        try {
          return sheet.cssRules;  // This will throw if CORS restricted
        } catch (e) {
          return false;
        }
      })
      .forEach(sheet => {
        Array.from(sheet.cssRules).forEach(rule => {
          styleEl.innerHTML += rule.cssText;
        });
      });
    
    svgClone.insertBefore(styleEl, svgClone.firstChild);
    
    // Get SVG as string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgClone);
    
    // Create download link
    const link = document.createElement("a");
    link.setAttribute("href", "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString));
    link.setAttribute("download", "org-chart.svg");
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Toggle dark mode
  function toggleDarkMode() {
    darkMode = !darkMode;
    
    // Update body class
    document.body.classList.toggle("dark-mode", darkMode);
    
    // Update button text
    document.getElementById("darkModeToggle").textContent = 
      darkMode ? "Light Mode" : "Dark Mode";
    
    // Update tree colors
    if (root) update(root);
    
    // Update legend
    updateLegend();
  }

  // Handle JSON file input and create the tree
  document.getElementById("fileInput").addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show loading indicator
    loadingIndicator.style("display", "flex");
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        let jsonData = JSON.parse(e.target.result);
        
        // Handle different data structures without forcing a Root node
        if (Array.isArray(jsonData)) {
          // If there's only one top-level item, use it as the root
          if (jsonData.length === 1) {
            jsonData = jsonData[0];
          } else {
            // For multiple top-level items, create a virtual root but hide it
            jsonData = { 
              name: "Organization", 
              children: jsonData,
              _isVirtualRoot: true  // Flag to identify virtual roots
            };
          }
        }
        
        // Store original data
        originalData = jsonData;
        
        // Clear previous error messages
        document.getElementById("errorMessage").textContent = "";
        
        // Show the empty state message
        document.getElementById("emptyState").style.display = "none";
        
        // Initialize SVG and build hierarchy
        renderTree(jsonData);

        // Show additional controls once data is loaded
        document.getElementById("additionalControls").style.display = "block";
        
        // Hide loading indicator
        loadingIndicator.style("display", "none");
      } catch (error) {
        console.error("Error parsing JSON:", error);
        document.getElementById("errorMessage").textContent = "Invalid JSON file. Please select a valid JSON file.";
        loadingIndicator.style("display", "none");
      }
    };
    reader.readAsText(file);
  });

  // Debounced event handlers for sliders
  const debouncedHorizontal = debounce(function(e) {
    sliderHorizontal = +e.target.value;
    document.getElementById("horizontalValue").textContent = sliderHorizontal;
    if (root) update(root);
  }, 100);

  const debouncedVertical = debounce(function(e) {
    sliderVertical = +e.target.value;
    document.getElementById("verticalValue").textContent = sliderVertical.toFixed(1);
    if (root) update(root);
  }, 100);

  document.getElementById("spacingSlider").addEventListener("input", debouncedHorizontal);
  document.getElementById("verticalSlider").addEventListener("input", debouncedVertical);

  // Update color toggle and refresh the tree
  document.getElementById("colorToggle").addEventListener("change", function(e) {
    colorToggle = e.target.value;
    if (root) {
      update(root);
      updateLegend();
    }
  });

  // Reset zoom/view button handler
  document.getElementById("resetButton").addEventListener("click", function() {
    d3.select("#treeContainer").select("svg").transition().duration(750).call(
      d3.zoom().transform, d3.zoomIdentity
    );
  });

  // Search input handler
  document.getElementById("searchInput").addEventListener("input", debounce(function(e) {
    const query = e.target.value.trim();
    searchNodes(query);
  }, 300));

      // Expand tree to specified level
  function expandToLevel(node, level) {
    if (!node) return;
    
    // Reset children
    node.children = null;
    
    // If we have stored children and are at or above target level, restore them
    if (node._children && node.depth < level) {
      node.children = node._children;
      // Process children recursively
      node.children.forEach(child => expandToLevel(child, level));
    }
  }
  
  // Toggle expand all
  document.getElementById("expandAllButton").addEventListener("click", function() {
    function expandAll(d) {
      // If this node has stored children, restore them
      if (d._children) {
        d.children = d._children;
      }
      
      // Process any existing children recursively
      if (d.children) {
        d.children.forEach(expandAll);
      }
    }
    
    if (root) {
      expandAll(root);
      update(root);
    }
  });

  // Toggle collapse all
  document.getElementById("collapseAllButton").addEventListener("click", function() {
    function collapse(d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
        d._children.forEach(collapse);
      }
    }
    
    if (root) {
      // Don't collapse the root node itself
      if (root.children) {
        root.children.forEach(collapse);
        update(root);
      }
    }
  });

  // Export button handler
  document.getElementById("exportButton").addEventListener("click", exportSVG);

  // Filter button handler
  document.getElementById("applyFilterButton").addEventListener("click", function() {
    const department = document.getElementById("filterDepartment").value;
    
    filterTree({
      department: department
    });
  });

  // Reset filter button handler
  document.getElementById("resetFilterButton").addEventListener("click", function() {
    if (originalData) {
      renderTree(originalData);
    }
  });

  // Dark mode toggle
  document.getElementById("darkModeToggle").addEventListener("click", toggleDarkMode);

  // Handle clicks outside of context menu to close it
  document.addEventListener("click", function(event) {
    if (!event.target.closest(".context-menu") && !event.target.closest(".node")) {
      d3.select(".context-menu").remove();
    }
  });

  // Hide context menu on escape key
  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      d3.select(".context-menu").remove();
    }
  });

  // Reinitialize tree on window resize
  window.addEventListener("resize", debounce(function() {
    setDimensions();
    if (root) {
      initializeSvg();
      update(root);
    }
  }, 200));

  // Initialize empty state message
  container.innerHTML += '<div id="emptyState" class="empty-state"><h2>No Organization Data Loaded</h2><p>Upload a JSON file to visualize your organization hierarchy.</p><div class="upload-icon">📁</div></div>';
})();