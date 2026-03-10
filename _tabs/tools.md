---
title: 小工具
icon: fas fa-toolbox
order: 6
---

<style>
.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}
a.tool-card.card {
  text-decoration: none !important;
  color: inherit;
  border-bottom: none !important;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}
a.tool-card.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--card-shadow);
  color: inherit;
  border-bottom: none !important;
}
.tool-card .card-body {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}
.tool-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--sidebar-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  color: var(--text-muted-color);
  flex-shrink: 0;
}
.tool-info {
  min-width: 0;
  flex: 1;
}
.tool-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--heading-color);
  margin: 0;
  line-height: 1.4;
}
.tool-desc {
  font-size: 0.85rem;
  color: var(--text-muted-color);
  margin: 0.3rem 0 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<div class="tool-grid">
  {% for tool in site.data.tools %}
    {% if tool.name and tool.url %}
      <a href="{{ tool.url }}" class="tool-card card">
        <div class="card-body">
          {% if tool.icon %}
            <span class="tool-icon"><i class="{{ tool.icon }}"></i></span>
          {% else %}
            <span class="tool-icon"><i class="fas fa-puzzle-piece"></i></span>
          {% endif %}
          <div class="tool-info">
            <div class="tool-name">{{ tool.name }}</div>
            {% if tool.description %}
              <div class="tool-desc">{{ tool.description }}</div>
            {% endif %}
          </div>
        </div>
      </a>
    {% endif %}
  {% endfor %}
</div>
