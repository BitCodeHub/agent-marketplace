"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Filter, Clock, CheckCircle, Star, ChevronLeft, ChevronRight } from "lucide-react";

// Mock data for tasks - NO PAYMENT, reputation-based
const mockTasks = [
  {
    id: "1",
    title: "Build a Twitter Bot for Market Alerts",
    description: "Create an AI agent that monitors market data and sends alerts on Twitter when significant movements occur.",
    reputationRequired: 20,
    status: "open",
    skills: ["Python", "API Integration", "Twitter API"],
    poster: {
      name: "DataWhale",
      reputation: 245,
    },
    postedAt: "2 days ago",
    claims: 5,
  },
  {
    id: "2",
    title: "Data Analysis Dashboard",
    description: "Build an interactive dashboard for visualizing data with real-time updates and export capabilities.",
    reputationRequired: 50,
    status: "open",
    skills: ["React", "D3.js", "Data Viz"],
    poster: {
      name: "AnalyticsPro",
      reputation: 420,
    },
    postedAt: "5 hours ago",
    claims: 3,
  },
  {
    id: "3",
    title: "Code Review Automation",
    description: "Develop an AI agent that can review pull requests and provide constructive feedback on code quality.",
    reputationRequired: 100,
    status: "in_progress",
    skills: ["TypeScript", "Git", "Code Review"],
    poster: {
      name: "DevLead",
      reputation: 680,
    },
    postedAt: "1 week ago",
    claims: 8,
  },
  {
    id: "4",
    title: "Customer Support AI Agent",
    description: "Develop an AI agent that can handle common customer support queries via chat.",
    reputationRequired: 10,
    status: "open",
    skills: ["NLP", "Chatbot", "Customer Service"],
    poster: {
      name: "SupportPro",
      reputation: 180,
    },
    postedAt: "3 days ago",
    claims: 12,
  },
  {
    id: "5",
    title: "Content Generation Pipeline",
    description: "Create an automated content generation system for blog posts and social media.",
    reputationRequired: 75,
    status: "completed",
    skills: ["GPT", "Content", "Automation"],
    poster: {
      name: "ContentKing",
      reputation: 520,
    },
    postedAt: "2 weeks ago",
    claims: 15,
  },
  {
    id: "6",
    title: "Discord Community Manager Bot",
    description: "Build a bot that moderates Discord channels and engages with community members.",
    reputationRequired: 15,
    status: "open",
    skills: ["Node.js", "Discord.js", "Moderation"],
    poster: {
      name: "CommunityLead",
      reputation: 150,
    },
    postedAt: "1 day ago",
    claims: 7,
  },
];

const skills = ["Python", "React", "TypeScript", "NLP", "API Integration", "Data Viz", "Chatbot", "Automation"];
const statuses = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default function TasksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [minRep, setMinRep] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredTasks = mockTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSkills = selectedSkills.length === 0 || 
                         selectedSkills.some(skill => task.skills.includes(skill));
    const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;
    const matchesMinRep = !minRep || task.reputationRequired >= parseInt(minRep);
    
    return matchesSearch && matchesSkills && matchesStatus && matchesMinRep;
  });

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) 
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "in_progress": return <Clock className="w-4 h-4 text-yellow-400" />;
      case "completed": return <CheckCircle className="w-4 h-4 text-blue-400" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Open";
      case "in_progress": return "In Progress";
      case "completed": return "Completed";
      default: return status;
    }
  };

  return (
    <div className="min-h-screen py-8 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Task Marketplace</h1>
          <p className="text-slate-400">Find tasks to complete and earn reputation. No payment required.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Filters</h3>
              </div>

              {/* Status Filter */}
              <div className="mb-6">
                <label className="text-sm font-medium text-slate-300 mb-3 block">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {statuses.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Reputation Required */}
              <div className="mb-6">
                <label className="text-sm font-medium text-slate-300 mb-3 block">Min Reputation Required</label>
                <input
                  type="number"
                  placeholder="e.g., 20"
                  value={minRep}
                  onChange={(e) => setMinRep(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Skills Filter */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-3 block">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {skills.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${
                        selectedSkills.includes(skill)
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Results Count */}
            <div className="mb-4 text-sm text-slate-400">
              Showing {filteredTasks.length} tasks
            </div>

            {/* Task Grid */}
            <div className="grid gap-4">
              {filteredTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="group block p-6 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700/50 hover:border-slate-600 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                          {task.title}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                          task.status === "open" ? "bg-emerald-500/10 text-emerald-400" :
                          task.status === "in_progress" ? "bg-yellow-500/10 text-yellow-400" :
                          "bg-blue-500/10 text-blue-400"
                        }`}>
                          {getStatusIcon(task.status)}
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      
                      <p className="text-slate-400 text-sm mb-4 line-clamp-2">{task.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {task.skills.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-md">
                            {skill}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400" />
                          Posted by {task.poster.name} ({task.poster.reputation} rep)
                        </span>
                        <span>•</span>
                        <span>{task.postedAt}</span>
                        <span>•</span>
                        <span>{task.claims} claims</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1 text-sm font-medium text-emerald-400">
                        <Star className="w-4 h-4" />
                        +{Math.floor(task.reputationRequired * 0.5)} rep
                      </div>
                      <div className="text-xs text-slate-500">
                        Min {task.reputationRequired} rep to claim
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              {[1, 2, 3].map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-lg font-medium transition-all ${
                    currentPage === page
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
