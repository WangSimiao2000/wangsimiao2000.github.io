---
title: 小工具
icon: fas fa-toolbox
order: 6
---

<style>
.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.tool-grid .card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.tool-grid .card:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow);
}
.tool-grid .card .card-body a {
  text-decoration: none;
  color: inherit;
  border-bottom: none !important;
}
.tool-grid .card .card-body a:hover {
  color: inherit;
  border-bottom: none !important;
}
.tool-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  opacity: 0.6;
  flex-shrink: 0;
}
.tool-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}
.tool-desc {
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
  opacity: 0.75;
}
</style>

<div class="tool-grid">
  {% for tool in site.data.tools %}
    {% if tool.name and tool.url %}
      <div class="card">
        <div class="card-body p-0">
          <a href="{{ tool.url }}" class="d-flex align-items-center p-0" style="padding: 1.25rem !important;">
            {% if tool.icon %}
              <span class="tool-icon me-3"><i class="{{ tool.icon }}"></i></span>
            {% else %}
              <span class="tool-icon me-3"><i class="fas fa-puzzle-piece"></i></span>
            {% endif %}
            <div>
              <div class="tool-name">{{ tool.name }}</div>
              {% if tool.description %}
                <div class="tool-desc">{{ tool.description }}</div>
              {% endif %}
            </div>
          </a>
        </div>
      </div>
    {% endif %}
  {% endfor %}
</div>
