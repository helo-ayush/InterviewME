function cleanRepo(repoData) {
  if (!repoData || !Array.isArray(repoData)) {
    return "No repository data available.";
  }

  return repoData.map((repo, index) => {
    let markdown = `### ${index + 1}. ${repo.name}\n`;
    markdown += `- **Description**: ${repo.description || "No description provided."}\n`;
    markdown += `- **Primary Language**: ${repo.language || "Not specified"}\n`;
    
    const topicsList = repo.topics && repo.topics.length > 0 ? repo.topics.join(', ') : "None";
    markdown += `- **Topics/Tech Stack**: ${topicsList}\n`;
    
    if (repo.homepage) {
      markdown += `- **Homepage/Demo**: ${repo.homepage}\n`;
    }
    
    markdown += `- **Is Fork**: ${repo.fork ? "Yes (Forked repository)" : "No (Original project)"}\n`;
    markdown += `- **Stars**: ${repo.stargazers_count || 0}\n`;
    
    // Format size from KB to MB if large
    const sizeInKB = repo.size || 0;
    const sizeText = sizeInKB > 1024 
      ? `${(sizeInKB / 1024).toFixed(1)} MB` 
      : `${sizeInKB} KB`;
    markdown += `- **Codebase Size**: ${sizeText}\n`;
    
    markdown += `- **Created At**: ${repo.created_at || "Unknown"}\n`;
    markdown += `- **Last Pushed At**: ${repo.pushed_at || "Unknown"}\n`;
    
    return markdown;
  }).join('\n');
}

module.exports = { cleanRepo };