# UI Components 组件库文档

Research Navigator 的完整UI组件库，基于 shadcn/ui 构建，包含基础组件和定制组件。

## 📋 **基础组件 (shadcn/ui)**

### 🔘 **按钮和交互**
- **Button** - 各种样式和尺寸的按钮组件
  - 变体: `default` | `destructive` | `outline` | `secondary` | `ghost` | `link`
  - 尺寸: `sm` | `default` | `lg` | `icon`

### 📝 **表单组件**
- **Input** - 文本输入框
- **Textarea** - 多行文本输入
- **Label** - 表单标签
- **Checkbox** - 复选框
- **Switch** - 开关切换
- **Select** - 下拉选择器
- **Slider** - 滑动条
- **Form** - 表单容器和验证

### 🎨 **布局和容器**
- **Card** - 卡片容器 (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`)
- **Separator** - 分隔线
- **ScrollArea** - 自定义滚动区域
- **Resizable** - 可调整大小的面板
- **Collapsible** - 可折叠容器

### 🗂️ **导航和选项卡**
- **Tabs** - 标签页组件
- **Accordion** - 手风琴折叠面板
- **DropdownMenu** - 下拉菜单

### 💬 **弹窗和提示**
- **Dialog** - 模态对话框
- **AlertDialog** - 确认对话框
- **Popover** - 弹出框
- **Tooltip** - 工具提示
- **Alert** - 警告提示框
- **Toaster** - Toast 通知

### 📊 **数据展示**
- **Table** - 数据表格
- **Badge** - 徽章标签
- **Progress** - 进度条
- **Skeleton** - 骨架屏加载

## 🎯 **定制组件 (Research Navigator)**

### 📈 **StatCard** - 统计卡片
```tsx
<StatCard 
  value="156" 
  label="收藏文献" 
  color="blue" 
/>
```
- **用途**: 显示统计数据
- **颜色**: `blue` | `green` | `purple` | `orange` | `red` | `yellow`

### 🎴 **FeatureCard** - 功能卡片
```tsx
<FeatureCard
  title="文献搜索"
  description="搜索最新研究"
  icon={<Search />}
  iconColor="blue"
  onClick={() => navigate('/search')}
/>
```
- **用途**: 展示功能入口，支持点击交互
- **图标颜色**: `blue` | `green` | `purple` | `orange` | `red` | `yellow`

### 📅 **ActivityItem** - 活动时间线项目
```tsx
<ActivityItem
  title="添加了新文献"
  timestamp="2小时前"
  icon={<Plus />}
  iconColor="blue"
/>
```
- **用途**: 显示活动历史和时间线
- **图标颜色**: 同上

## 🎨 **设计系统**

### 颜色主题
- **Blue**: 主要操作、信息提示
- **Green**: 成功状态、完成动作
- **Purple**: 分析、洞察相关
- **Orange**: 警告、AI相关
- **Red**: 错误、删除操作
- **Yellow**: 收藏、重要标记

### 响应式设计
所有组件都支持响应式设计，使用 Tailwind CSS 的响应式前缀：
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+

## 📱 **使用示例**

```tsx
import { 
  Button, 
  Card, 
  CardContent,
  StatCard,
  FeatureCard 
} from '@/components/ui';

function ExamplePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value="156" label="文献" color="blue" />
            <StatCard value="8" label="项目" color="green" />
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FeatureCard
          title="搜索"
          description="查找文献"
          icon={<Search />}
          iconColor="blue"
          onClick={() => console.log('搜索')}
        />
      </div>
    </div>
  );
}
```

## 🔧 **开发指南**

### 添加新组件
1. 在 `src/components/ui/` 创建组件文件
2. 在 `index.ts` 中导出
3. 遵循现有的设计模式和命名约定

### 样式约定
- 使用 Tailwind CSS 类名
- 支持 `className` prop 进行样式覆盖
- 使用 `cn()` 工具函数合并类名
- 支持深色模式 (`dark:` 前缀)

### TypeScript 类型
- 所有组件都有完整的 TypeScript 类型定义
- 导出必要的类型接口供外部使用
