"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"

interface Task {
    id: string
    title: string
    description: string
    status: string
    project_id: string
}

interface Project {
    id: string
    name: string
    description: string
}

export default function ProjectPage({ params }: { params: { id: string } }) {
    const [project, setProject] = useState<Project | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [newTaskTitle, setNewTaskTitle] = useState("")
    const router = useRouter()
    // Unwrapping params is required in newer Next versions if async/await but here we use simple access or use hook
    // But params is passed as prop.

    useEffect(() => {
        fetchProjectAndTasks()

        // Subscribe to tasks
        const channel = supabase
            .channel('tasks-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${params.id}` },
                (payload) => {
                    console.log('Change received!', payload)
                    fetchProjectAndTasks() // simple re-fetch for now, optimized later
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [params.id])

    const fetchProjectAndTasks = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push("/login")
            return
        }

        // Fetch Project
        const { data: projectData } = await supabase
            .from("projects")
            .select("*")
            .eq("id", params.id)
            .single()

        setProject(projectData)

        // Fetch Tasks
        const { data: tasksData } = await supabase
            .from("tasks")
            .select("*")
            .eq("project_id", params.id)
            .order("created_at", { ascending: false })

        setTasks(tasksData || [])
        setLoading(false)
    }

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTaskTitle) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from("tasks").insert({
            project_id: params.id,
            title: newTaskTitle,
            description: "", // simplified for speed
            status: "todo",
            assigned_to: user.id
        })

        if (error) {
            alert(error.message)
        } else {
            setNewTaskTitle("")
            // Realtime will update list
        }
    }

    if (loading) return <div className="p-8">Loading...</div>
    if (!project) return <div className="p-8">Project not found</div>

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold">{project.name}</h1>
                <p className="text-muted-foreground">{project.description}</p>
            </div>

            <div className="flex gap-8">
                {/* Task List */}
                <div className="flex-1 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tasks</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateTask} className="flex gap-2 mb-4">
                                <Input
                                    placeholder="New task title..."
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                />
                                <Button type="submit"><Plus className="w-4 h-4" /></Button>
                            </form>

                            <div className="space-y-2">
                                {tasks.map(task => (
                                    <Card key={task.id} className="p-4" onClick={() => router.push(`/project/${params.id}/task/${task.id}`)}>
                                        <div className="flex justify-between items-center">
                                            <span className={task.status === 'done' ? 'line-through text-gray-500' : ''}>{task.title}</span>
                                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">{task.status}</span>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
