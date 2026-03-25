import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { UserNode, UserLink, SocialGraph } from './types';
import { cn } from './lib/utils';
import { 
  Heart, 
  MessageSquare, 
  Search, 
  RefreshCw,
  ExternalLink,
  X,
  Users,
  LayoutGrid,
  Settings,
  Bell,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Data Generation ---
const generateData = (nodeCount: number): SocialGraph => {
  const nodes: UserNode[] = [];
  const roles = ['Engineer', 'Designer', 'Product Manager', 'Artist', 'Researcher', 'Developer', 'Analyst'];
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Quinn', 'Avery', 'Skyler'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  for (let i = 0; i < nodeCount; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    nodes.push({
      id: `u-${i}`,
      name: `${firstName} ${lastName}`,
      avatar: `https://picsum.photos/seed/${i + 200}/100/100`,
      role: roles[Math.floor(Math.random() * roles.length)],
      bio: `Professional ${roles[Math.floor(Math.random() * roles.length)]} at Google. Focused on building helpful products for everyone.`
    });
  }

  const links: UserLink[] = [];
  const linkSet = new Set<string>();
  
  // Create some "Hub" nodes (Influencers)
  const hubIndices = Array.from({ length: 12 }, () => Math.floor(Math.random() * nodeCount));

  for (let i = 0; i < nodeCount; i++) {
    const isHub = hubIndices.includes(i);
    const connectionsCount = isHub ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 2) + 1;

    for (let j = 0; j < connectionsCount; j++) {
      const targetIndex = (Math.random() > 0.00001 && !isHub) 
        ? hubIndices[Math.floor(Math.random() * hubIndices.length)]
        : Math.floor(Math.random() * nodeCount);

      if (targetIndex !== i) {
        const linkKey = [i, targetIndex].sort((a, b) => a - b).join('-');
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey);
          links.push({
            source: `u-${i}`,
            target: `u-${targetIndex}`,
            isStrong: Math.random() > 0.7 // 30% chance of strong connection
          });
        }
      }
    }
  }

  return { nodes, links };
};

export default function App() {
  const [nodeCount] = useState(20);
  const [graphData, setGraphData] = useState<SocialGraph>(() => generateData(20));
  const [selectedNode, setSelectedNode] = useState<UserNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMiniPopupOpen, setIsMiniPopupOpen] = useState(false);
  const [isConnectionsPopupOpen, setIsConnectionsPopupOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate degrees for node sizing
  const nodeDegrees = useMemo(() => {
    const degrees: Record<string, number> = {};
    graphData.nodes.forEach(n => degrees[n.id] = 0);
    graphData.links.forEach(l => {
      const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      degrees[sourceId] = (degrees[sourceId] || 0) + 1;
      degrees[targetId] = (degrees[targetId] || 0) + 1;
    });
    return degrees;
  }, [graphData]);

  const getRadius = (nodeId: string) => {
    const degree = nodeDegrees[nodeId] || 0;
    // Smaller, cleaner Google-style scaling
    return Math.min(80, 24 + Math.pow(degree, 1.2) * 3.0);
  };

  const handleRegenerate = () => {
    setGraphData(generateData(nodeCount));
    setSelectedNode(null);
  };

  const strongConnectionsCount = useMemo(() => {
    if (!selectedNode) return 0;
    return graphData.links.filter(l => 
      ((typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
      (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id) &&
      l.isStrong
    ).length;
  }, [selectedNode, graphData]);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height])
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const container = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        setSelectedNode(null);
        setIsMiniPopupOpen(false);
      }
    });

    const simulation = d3.forceSimulation(graphData.nodes as any)
      .force('link', d3.forceLink(graphData.links).id((d: any) => d.id).distance(d => {
        const sourceR = getRadius(typeof d.source === 'string' ? d.source : (d.source as any).id);
        const targetR = getRadius(typeof d.target === 'string' ? d.target : (d.target as any).id);
        // Strong connections pull nodes closer
        return ((d as any).isStrong ? 600 : 1200) + sourceR + targetR;
      }).strength((d: any) => d.isStrong ? 0.15 : 0.05))
      .force('charge', d3.forceManyBody().strength((d: any) => -5000 - getRadius(d.id) * 150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => getRadius(d.id) + 200))
      .force('radial', d3.forceRadial((d: any) => {
        const degree = nodeDegrees[d.id] || 0;
        return Math.max(0, 10000 - degree * 500);
      }, width / 2, height / 2).strength(0.00001));

    // Links
    const link = container.append('g')
      .selectAll('path')
      .data(graphData.links)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#4285f4')
      .attr('stroke-width', (d: any) => d.isStrong ? 6 : 2)
      .attr('stroke-dasharray', '8,8')
      .attr('class', 'link-animated')
      .attr('stroke-opacity', 0.4)
      .style('pointer-events', 'none');

    // Nodes
    const node = container.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'node-group cursor-pointer')
      .on('click', (event, d: any) => {
        event.stopPropagation();
        setSelectedNode(d);
        setIsMiniPopupOpen(true);
      })
      .call(d3.drag<SVGGElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Node Circles
    node.append('circle')
      .attr('r', (d: any) => getRadius(d.id))
      .attr('fill', '#fff')
      .attr('stroke', '#dadce0')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 1px 2px rgba(60,64,67,0.15))');

    // Avatar patterns
    const defs = svg.append('defs');
    graphData.nodes.forEach((n) => {
      const r = getRadius(n.id);
      defs.append('pattern')
        .attr('id', `avatar-${n.id}`)
        .attr('patternUnits', 'objectBoundingBox')
        .attr('width', 1)
        .attr('height', 1)
        .append('image')
        .attr('xlink:href', n.avatar)
        .attr('width', r * 2)
        .attr('height', r * 2)
        .attr('x', 0)
        .attr('y', 0);
    });

    node.select('circle')
      .attr('fill', (d: any) => `url(#avatar-${d.id})`);

    // Labels
    node.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => getRadius(d.id) + 30)
      .style('font-size', (d: any) => Math.max(12, 11 + getRadius(d.id) / 10) + 'px')
      .text((d: any) => d.name.split(' ')[0]);

    simulation.on('tick', () => {
      link.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => simulation.stop();
  }, [graphData]);

  // Highlight logic
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    if (selectedNode) {
      const connectedNodeIds = new Set<string>();
      connectedNodeIds.add(selectedNode.id);
      
      graphData.links.forEach(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
        if (s === selectedNode.id) connectedNodeIds.add(t);
        if (t === selectedNode.id) connectedNodeIds.add(s);
      });

      svg.selectAll('g.cursor-pointer')
        .transition().duration(300)
        .style('opacity', (d: any) => connectedNodeIds.has(d.id) ? 1 : 0.1)
        .style('filter', (d: any) => d.id === selectedNode.id ? 'drop-shadow(0 0 20px rgba(66,133,244,0.5))' : 'none');

      svg.selectAll('line')
        .transition().duration(300)
        .style('opacity', (d: any) => {
          const s = typeof d.source === 'string' ? d.source : (d.source as any).id;
          const t = typeof d.target === 'string' ? d.target : (d.target as any).id;
          return (s === selectedNode.id || t === selectedNode.id) ? 1 : 0.05;
        });
    } else {
      svg.selectAll('g.cursor-pointer').transition().duration(300).style('opacity', 1).style('filter', 'none');
      svg.selectAll('line').transition().duration(300).style('opacity', 0.6);
    }
  }, [selectedNode, graphData]);

  return (
    <div className="relative w-full h-screen bg-[#f8f9fa] text-[#202124] overflow-hidden font-sans">
      {/* Back Button - Top Left */}
      <div className="absolute top-6 left-6 z-40">
        <button 
          onClick={() => {
            setSelectedNode(null);
            setIsMiniPopupOpen(false);
          }}
          className="w-12 h-12 flex items-center justify-center shadow-lg border border-[#dadce0] bg-white rounded-full hover:shadow-xl transition-all text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Title - Top Center */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40">
        <h1 className="text-lg font-google font-normal text-[#5f6368] tracking-[0.2em] uppercase select-none">
          Comments Maps
        </h1>
      </div>

      {/* Search Module - Top Right */}
      <div className="absolute top-6 right-6 z-40 flex justify-end">
        <motion.div 
          initial={false}
          animate={{ width: isSearchExpanded ? 320 : 48 }}
          className="search-bar flex items-center shadow-lg border border-[#dadce0] bg-white h-12 rounded-full hover:shadow-xl transition-all overflow-hidden p-0"
        >
          <button 
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
            className={cn(
              "flex-shrink-0 w-12 h-12 flex items-center justify-center transition-colors",
              isSearchExpanded ? "text-[#4285f4]" : "text-[#5f6368] hover:bg-[#f1f3f4]"
            )}
          >
            <Search size={24} strokeWidth={2.5} />
          </button>
          <AnimatePresence>
            {isSearchExpanded && (
              <motion.input 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                autoFocus
                type="text" 
                placeholder="Search network..." 
                className="bg-transparent border-none outline-none text-sm w-full pr-6 font-medium placeholder:text-[#9aa0a6]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setIsSearchExpanded(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="w-full h-full">
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* Mini Profile Popup - Bottom Right */}
      <AnimatePresence>
        {isMiniPopupOpen && selectedNode && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 right-6 w-80 bg-white shadow-2xl border border-[#dadce0] rounded-3xl z-40 overflow-hidden"
          >
            <div className="p-4 flex items-center gap-4 border-b border-[#f1f3f4]">
              <img 
                src={selectedNode.avatar} 
                alt={selectedNode.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-[#202124] truncate">{selectedNode.name}</h4>
                <p className="text-xs text-[#5f6368] truncate">{selectedNode.role}</p>
              </div>
              <button 
                onClick={() => setIsMiniPopupOpen(false)}
                className="p-1.5 hover:bg-[#f1f3f4] rounded-full text-[#5f6368]"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4">
              <div className="text-[10px] font-bold text-[#5f6368] uppercase tracking-widest mb-3">Connections</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {graphData.links
                  .filter(l => 
                    (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
                    (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id
                  )
                  .slice(0, 5)
                  .map((l, i) => {
                    const targetId = (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id
                      ? (typeof l.target === 'string' ? l.target : (l.target as any).id)
                      : (typeof l.source === 'string' ? l.source : (l.source as any).id);
                    const targetNode = graphData.nodes.find(n => n.id === targetId);
                    return targetNode ? (
                      <img 
                        key={i}
                        src={targetNode.avatar} 
                        alt={targetNode.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                        title={targetNode.name}
                      />
                    ) : null;
                  })}
                {graphData.links.filter(l => 
                  (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
                  (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id
                ).length > 5 && (
                  <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center text-xs font-bold text-[#5f6368] border-2 border-white shadow-sm">
                    +{graphData.links.filter(l => 
                      (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
                      (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id
                    ).length - 5}
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setIsConnectionsPopupOpen(true)}
                className="w-full py-2 bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#4285f4] text-xs font-medium rounded-full transition-colors border border-[#dadce0]"
              >
                View Connections
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connections Popup */}
      <AnimatePresence>
        {isConnectionsPopupOpen && selectedNode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-[#dadce0] flex justify-between items-center bg-[#f8f9fa]">
                <div className="flex items-center gap-4">
                  <img src={selectedNode.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                  <div>
                    <h3 className="text-xl font-medium text-[#202124]">{selectedNode.name}'s Network</h3>
                    <p className="text-sm text-[#5f6368]">All active connections</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsConnectionsPopupOpen(false)}
                  className="p-2 hover:bg-[#e8eaed] rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-3">
                  {graphData.links
                    .filter(l => 
                      (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
                      (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id
                    )
                    .map((link, idx) => {
                      const otherId = (typeof link.source === 'string' ? link.source : (link.source as any).id) === selectedNode.id 
                        ? (typeof link.target === 'string' ? link.target : (link.target as any).id)
                        : (typeof link.source === 'string' ? link.source : (link.source as any).id);
                      const otherNode = graphData.nodes.find(n => n.id === otherId);
                      
                      if (!otherNode) return null;

                      return (
                        <div key={idx} className="flex items-center justify-between p-4 bg-[#f8f9fa] rounded-2xl border border-[#dadce0] hover:border-[#4285f4] transition-all group">
                          <div className="flex items-center gap-4">
                            <img src={otherNode.avatar} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                            <div>
                              <p className="font-medium text-[#202124]">{otherNode.name}</p>
                              <p className="text-xs text-[#5f6368]">{otherNode.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e8f0fe] text-[#4285f4]">
                              Active
                            </div>
                            {link.isStrong && (
                              <div className="bg-[#e6f4ea] text-[#34a853] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                Strong
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
