import os
import sys
import shutil
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_cohere import CohereEmbeddings  # type: ignore
from langchain_cohere import ChatCohere  # type: ignore
from langchain_chroma import Chroma  # type: ignore
from langchain.chains import RetrievalQA
from langchain.schema import Document
import json
import glob
from langchain.text_splitter import CharacterTextSplitter

SUPPORTED_LANGUAGES = [
    "cpp", "go", "java", "kotlin", "js", "ts", "php", "proto",
    "python", "rst", "ruby", "rust", "scala", "swift", "markdown"
    "latex", "html", "sol", "csharp", "cobol", "c", "lua", "perl",
    "haskell", "elixir", "powershell"
]

project_path = 'C:\\Users\\uc201\\FileGuide\\fileguide\\MultipleTypesFiles'
#project_path = 'C:\\Users\\uc201\\FileGuide\\fileguide\\Project1'
userTask = 'I want to go to mars'

class CustomDirectoryLoader:
    def __init__(self, project_path, glob_pattern="**/*"):
        self.project_path = project_path
        self.glob_pattern = glob_pattern

    def load(self):
        all_docs = []
        
        # Use glob to find all matching files
        for file_path in glob.glob(os.path.join(self.project_path, self.glob_pattern), recursive=True):
            if os.path.isfile(file_path):  # Ensure it's a file, not a directory
                if file_path.endswith(".json"):
                    try:
                        # Manually load JSON content as text
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = json.load(f)
                        json_content = json.dumps(content, indent=2)
                        all_docs.append(Document(page_content=json_content, metadata={'source': file_path}))
                    except Exception as e:
                        print(f"Error loading JSON file {file_path}: {e}")
                else:
                    try:
                        # Load non-JSON files as plain text
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        all_docs.append(Document(page_content=content, metadata={'source': file_path}))
                    except Exception as e:
                        print(f"Error loading file {file_path}: {e}")
        
        return all_docs



# Initialize the custom loader
try:
    loader = CustomDirectoryLoader(project_path)
    docs = loader.load()
    print(f"Total documents loaded: {len(docs)}")
except Exception as e:
    print(f"Error loading documents: {e}")
    sys.exit(1)

# Updated language map to match RecursiveCharacterTextSplitter's expected identifiers
def get_language_and_chunk_params(doc):
    file_ext = os.path.splitext(doc.metadata['source'])[1].lower()
    language_map = {
        '.py': 'python',
        '.js': 'js',
        '.ts': 'ts',  
        '.java': 'java',
        '.cpp': 'cpp',
        '.cs': 'csharp',
        '.rb': 'ruby',
        '.html': 'html',
        '.go': 'go',
        '.php': 'php',
        '.md': 'markdown', #not working?
        '.rst': 'rst',
        '.c': 'c',
        '.h': 'c',  # Header files treated as C for splitting
        '.swift': 'swift',
        '.scala': 'scala',
        '.rs': 'rust',  
        '.sol': 'sol',  
        '.tex': 'latex',
        '.ps1': 'powershell',  
        #missing some languages
    }
    # Default to text if no matching extension is found
    return language_map.get(file_ext, 'text')


# Function to adapt chunk parameters based on document length
def get_chunk_params(doc_length):
    if doc_length < 500:
        return {"chunk_size": doc_length, "chunk_overlap": 0}
    elif doc_length < 2000:
        return {"chunk_size": 300, "chunk_overlap": 50}
    else:
        return {"chunk_size": 500, "chunk_overlap": 100}

adaptive_texts = []
for doc in docs:
    language = get_language_and_chunk_params(doc)
    params = get_chunk_params(len(doc.page_content))
    
    try:
        if language in SUPPORTED_LANGUAGES:
            splitter = RecursiveCharacterTextSplitter.from_language(language=language, **params)
        else:
            print(f"Unsupported language '{language}' for file: {doc.metadata['source']}. Using fallback.")
            splitter = CharacterTextSplitter(**params)

        for chunk in splitter.split_documents([doc]):
            chunk_with_path = f"# File: {doc.metadata['source']}\n{chunk.page_content}"
            adaptive_texts.append(Document(page_content=chunk_with_path, metadata=doc.metadata))
    except Exception as e:
        print(f"Error processing document {doc.metadata['source']}: {e}")
        sys.exit(1)

print(f"Total number of chunks created: {len(adaptive_texts)}")


# Initialize embeddings model
try:
    embeddings_model = CohereEmbeddings(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model='embed-english-v3.0')
except Exception as e:
    print(f"Error initializing embeddings model: {e}")
    sys.exit(1)

# Ensure the 'data' directory is fresh for Chroma storage
if os.path.exists('./data'):
    try:
        shutil.rmtree('./data')
    except Exception as e:
        print(f"Error removing existing 'data' directory: {e}")
        sys.exit(1)

# Initialize Chroma with error handling
try:
    vectordb = Chroma.from_documents(adaptive_texts, embedding=embeddings_model, persist_directory='./data')
except Exception as e:
    print(f"Error initializing Chroma vector database: {e}")
    sys.exit(1)

# Initialize the LLM model and RetrievalQA
try:
    llm = ChatCohere(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model="command-r-plus-08-2024")

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type='stuff',
        retriever=vectordb.as_retriever(search_type="mmr"),
        verbose=True
    )
except Exception as e:
    print(f"Error initializing LLM or QA chain: {e}")
    sys.exit(1)

finalPrompt = f"""Analyze the documents i have provided and based on this specific task: {userTask}, determine the likelihood that each file will need to be modified in order to complete said task. 
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30% .List the files by probability in descending order, include only the file path and probability, 
and avoid any additional text or explanations."""

finalPromptV2 = f"""
Analyze the documents I have provided and based on this specific task: {userTask}, determine the likelihood that each file will need to be modified in order to complete said task. 
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30%. List the files by probability in descending order, include only the file path and probability, 
and avoid any additional text or explanations.
I would also like you to analyze if the task makes sense in the context of the project. If it does, the output remains as explained above; otherwise, suggest another task for the user, 
using the format: "The task does not seem to align with the project's context. 
Suggested task: ...."
"""

# Run the query if the QA chain is available
try:
    response = qa_chain.invoke({"query": finalPromptV2, "chat_history": []})
    print(response['result'])
except Exception as e:
    print(f"Error executing query on the QA chain: {e}")
    sys.exit(1)
