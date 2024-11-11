import sys
import os
import shutil
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders.generic import GenericLoader
from langchain_community.document_loaders.parsers import LanguageParser

from langchain_cohere import CohereEmbeddings
from langchain_cohere import ChatCohere

from langchain_chroma import Chroma
from langchain.memory import ConversationSummaryBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.chains import RetrievalQA
from langchain_community.document_loaders import DirectoryLoader
from langchain.schema import Document

# Load Python files recursively from the specified project path
project_path = 'C:\\Users\\uc201\\FileGuide\\fileguide\\Project1\\'
userTask = 'I want to change the logic of the down movement'

print("Step 2: Load and parse Python files from the specified local directory")
loader = DirectoryLoader(
    project_path,
    glob="**/*.py"  # Recursive search for .py files in all subdirectories
)
docs = loader.load()

# Print each document's path and content length to detect duplicates
print("Loaded files with content lengths:")
for idx, doc in enumerate(docs):
    print(f"Document {idx+1}: {doc.metadata.get('source')}, Content length: {len(doc.page_content)}")

# Function to adapt chunking parameters
def get_chunk_params(doc_length):
    if doc_length < 500:
        return {"chunk_size": doc_length, "chunk_overlap": 0}  # No splitting needed
    elif doc_length < 2000:
        return {"chunk_size": 300, "chunk_overlap": 50}
    else:
        return {"chunk_size": 500, "chunk_overlap": 100}

# Adjust the chunk creation to prepend each chunk with its file path
print("Step 3: Chunk the code for efficient processing")
adaptive_texts = []
for doc in docs:
    # Get adaptive chunk parameters based on document length
    params = get_chunk_params(len(doc.page_content))
    documents_splitter = RecursiveCharacterTextSplitter.from_language(
        language="python",
        **params
    )
    # Split document into chunks, and add file path within the chunk content
    for chunk in documents_splitter.split_documents([doc]):
        # Prepend the file path to the chunk's content
        chunk_with_path = f"# File: {doc.metadata['source']}\n{chunk.page_content}"
        # Create a new Document with the modified content and original metadata
        adaptive_texts.append(Document(page_content=chunk_with_path, metadata=doc.metadata))

print(f"Total number of chunks created: {len(adaptive_texts)}")


# Initialize the embeddings model
embeddings_model = CohereEmbeddings(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model='embed-english-v3.0')

# Ensure the 'data' directory is fresh for Chroma storage
if os.path.exists('./data'):
    shutil.rmtree('./data')

# Initialize Chroma with the embeddings and persist settings
vectordb = Chroma.from_documents(adaptive_texts, embedding=embeddings_model, persist_directory='./data')

print("Embeddings successfully stored in vector database.")

print("Step 5: Initialize the LLM and memory for retrieval chain")
llm = ChatCohere(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model="command-r-plus-08-2024")

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type='stuff',
    retriever=vectordb.as_retriever(search_type="mmr"),
    verbose=True
)

# Prompt the LLM with file path-aware probability estimation
finalPrompt = """Analyze the documents i have provided and based on this specific task: """ + userTask + """, determine the likelihood that each file will need to be modified in order to complete said task. 
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30% .List the files by probability in descending order, include only the file path and probability, 
and avoid any additional text or explanations."""

finalPromptV2 = """
    Give me a summary of the documents i have provided
"""

a = """
    I want to change the delete_snapshots function, which file should i change?
"""

response = qa_chain.invoke({"query": finalPrompt, "chat_history": []})
print(response['result'])
